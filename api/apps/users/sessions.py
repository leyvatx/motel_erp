"""Sesiones vivas: alta, latido y revocación inmediata.

El corte tiene que sentirse al instante, y eso choca con lo que hace útil a un
JWT: que se valide sin preguntarle a nadie. Revocar el refresh token no basta,
porque el access token que ya trae el navegador sigue siendo criptográficamente
válido hasta media hora después.

La salida es preguntar por la sesión en cada petición, pero preguntándole a
Redis y no a PostgreSQL. Cada sesión guarda su estado bajo una clave propia, y
revocar escribe la clave negativa antes de tocar la base: como Redis lo comparte
todo el despliegue, el siguiente request de esa persona -- en cualquier worker --
ya la encuentra revocada.

Un detalle que parece de más y no lo es: se cachean los dos estados, viva y
revocada, no solo el revocado. Cachear únicamente lo revocado sería más barato
-- ausencia significaria "válida" y no habría consulta ninguna para la gente
normal -- pero entonces un reinicio de Redis, o una expulsión de claves por
memoria, resucitaría todas las sesiones revocadas. Prefiero pagar una consulta
cada diez minutos por sesión antes que fallar abriendo.
"""

from __future__ import annotations

import logging
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from apps.users.models import User, UserSession
from common.middleware import get_current_ip, get_current_user_agent

logger = logging.getLogger(__name__)

CLAVE_SESION = "sid"

VIVA = "viva"
REVOCADA = "revocada"

# Diez minutos para lo vivo: acota cuánto puede tardar en notarse un cambio
# hecho por fuera -- un borrado a mano en la base -- sin que la consulta pese.
TTL_VIVA = 600
# Un día para lo revocado. No hace falta más: pasado el tiempo de vida del
# refresh token la sesión ya no sirve para nada aunque se creyera viva.
TTL_REVOCADA = 86_400
# Cada cuánto baja la marca de actividad a la base. Sin esto sería una
# escritura por petición.
TTL_LATIDO = 120


def _clave_estado(sid: Any) -> str:
    return f"sesion:estado:{sid}"


def _clave_latido(sid: Any) -> str:
    return f"sesion:visto:{sid}"


def _cache_get(clave: str) -> str | None:
    """Lee de la caché sin dejar que un Redis caído tumbe la petición.

    Devolver ``None`` manda la decisión a la base: se pierde velocidad, nunca
    corrección.
    """
    try:
        return cache.get(clave)
    except Exception:
        logger.warning("La caché no respondió al leer %s; se consulta la base.", clave)
        return None


def _cache_set(clave: str, valor: str, ttl: int) -> None:
    try:
        cache.set(clave, valor, ttl)
    except Exception:
        logger.warning("La caché no respondió al guardar %s.", clave)


def abrir(user: User) -> UserSession:
    """Registra la sesión al iniciar y devuelve su renglón.

    La IP y el navegador salen del contexto de la petición, que el middleware ya
    publicó. Es el único momento en que se conocen de forma confiable: el
    refresh no vuelve a traerlos.
    """
    sesion = UserSession.objects.create(
        user=user,
        ip_address=get_current_ip(),
        user_agent=get_current_user_agent(),
        last_seen_at=timezone.now(),
    )
    _cache_set(_clave_estado(sesion.sid), VIVA, TTL_VIVA)
    return sesion


def esta_revocada(sid: Any) -> bool:
    """Si esta sesión ya no vale. Contesta desde Redis salvo la primera vez.

    Una ``sid`` sin renglón cuenta como revocada. Es la postura estricta a
    propósito: la única forma de llegar ahí es que alguien haya borrado la
    sesión, y eso es una revocación con otro nombre. Los tokens emitidos antes
    de que existiera este modelo no traen ``sid`` y ni siquiera llegan aquí.
    """
    clave = _clave_estado(sid)
    cacheado = _cache_get(clave)
    if cacheado == VIVA:
        return False
    if cacheado == REVOCADA:
        return True

    sesion = UserSession.objects.filter(sid=sid).only("revoked_at").first()
    revocada = sesion is None or sesion.revoked_at is not None
    _cache_set(clave, REVOCADA if revocada else VIVA, TTL_REVOCADA if revocada else TTL_VIVA)
    return revocada


def latir(sid: Any) -> None:
    """Baja la marca de actividad, como mucho una vez cada ``TTL_LATIDO``.

    La marca vive en la base porque la pantalla de sesiones la muestra, pero
    escribirla en cada petición sería cambiar una consulta por una escritura.
    La clave de la caché hace de reloj: mientras exista, no se escribe.
    """
    clave = _clave_latido(sid)
    if _cache_get(clave) is not None:
        return
    _cache_set(clave, "1", TTL_LATIDO)
    UserSession.objects.filter(sid=sid, revoked_at__isnull=True).update(
        last_seen_at=timezone.now()
    )


def renovar(sid: Any, jti: str, expires_at) -> None:
    """Deja constancia del token vigente tras rotar."""
    UserSession.objects.filter(sid=sid, revoked_at__isnull=True).update(
        jti=jti, expires_at=expires_at, last_seen_at=timezone.now()
    )


def revocar(sesion: UserSession, *, actor: User | None = None) -> UserSession:
    """Corta la sesión ahora, no en el próximo refresh.

    Primero la caché y después la base. Si algo falla entre las dos, el peor
    caso es una sesión marcada como muerta en Redis que la base todavía cree
    viva, y eso se corrige solo al expirar la clave. Al revés -- base primero --
    el peor caso es alguien expulsado operando diez minutos más, que es justo lo
    que este código existe para evitar.
    """
    _cache_set(_clave_estado(sesion.sid), REVOCADA, TTL_REVOCADA)
    sesion.revoked_at = timezone.now()
    sesion.revoked_by = actor
    sesion.save(update_fields=["revoked_at", "revoked_by", "updated_at"])
    return sesion


def revocar_por_sid(sid: Any, *, actor: User | None = None) -> UserSession | None:
    sesion = UserSession.objects.filter(sid=sid, revoked_at__isnull=True).first()
    return revocar(sesion, actor=actor) if sesion else None


def vivas():
    """Sesiones que todavía sirven, de la más reciente a la más vieja."""
    ahora = timezone.now()
    return (
        UserSession.objects.select_related("user")
        .filter(revoked_at__isnull=True)
        .exclude(expires_at__lt=ahora)
        .order_by("-last_seen_at", "-created_at")
    )
