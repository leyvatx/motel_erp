"""Sondeo de vida del contenedor: base de datos y caché.

Es una vista de Django a secas, no de DRF: el sondeo entra sin sesión y sin
motel, y las clases de permiso por omisión de la API lo rechazarían. Por lo
mismo queda exenta de la redirección a HTTPS en ``SECURE_REDIRECT_EXEMPT``,
porque Docker la consulta por loopback y en claro.

Responde 200 solo si ambas dependencias contestan. Cuando algo falla, el 503
dice cuál de las dos fue: distinguir "se cayó la base" de "se cayó Redis" sin
entrar a leer bitácoras es la única razón por la que este endpoint existe.
"""

from __future__ import annotations

import logging

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone

PROBE_KEY = "health:probe"

# Rutas que no valen la línea de bitácora. El despertador pega cada 10 min y
# Render sondea healthCheckPath solo, así que sin esto la bitácora de producción
# es un muro de 200 idénticos y el error de verdad se pierde entre ellos.
RUTAS_SILENCIOSAS = ("/api/health", "/api/v1/health/")


class SilenciarSondeos(logging.Filter):
    """Quita de la bitácora de acceso los sondeos de vida.

    Se cuelga de ``uvicorn.access``, que registra la ruta en ``record.args``
    como quinta tupla ``(cliente, método, ruta, versión, código)``, y de
    ``django.server``, que en desarrollo la mete dentro del mensaje ya armado.
    Solo calla los 2xx y 3xx: si un sondeo empieza a responder 500 esa línea es
    justo la que hay que ver.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args if isinstance(record.args, tuple) else ()

        if len(args) >= 5 and isinstance(args[2], str):
            ruta, codigo = args[2], args[4]
        else:
            texto = record.getMessage()
            if not any(r in texto for r in RUTAS_SILENCIOSAS):
                return True
            ruta, codigo = texto, 200 if '" 2' in texto or '" 3' in texto else 500

        if not any(ruta.startswith(r) or r in ruta for r in RUTAS_SILENCIOSAS):
            return True

        try:
            return not 200 <= int(codigo) < 400
        except (TypeError, ValueError):
            return True


def awake(request) -> JsonResponse:
    """Sonda de vida: contesta que el proceso está en pie y nada más.

    Aparte a propósito de ``health``. Aquella pregunta si el servicio puede
    trabajar y contesta 503 cuando Redis parpadea; esta solo pregunta si el
    contenedor despertó. Mezclarlas rompe las dos cosas: el despertador fallaría
    por un hipo de Redis que no tiene nada que ver con estar dormido, y sondear
    la base cada diez minutos no hace nada por nadie.
    """
    return JsonResponse({"status": "awake", "timestamp": timezone.now().isoformat()})


def _probe(operation) -> str:
    try:
        operation()
    except Exception as exc:
        return f"error: {exc.__class__.__name__}"
    return "ok"


def _database() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


def _cache() -> None:
    cache.set(PROBE_KEY, "1", 10)
    if cache.get(PROBE_KEY) != "1":
        raise RuntimeError("La caché no devolvió lo que se acaba de guardar.")


def health(request) -> JsonResponse:
    """Estado de las dependencias que la API necesita para operar."""
    estado = {"database": _probe(_database), "cache": _probe(_cache)}
    sano = all(valor == "ok" for valor in estado.values())
    return JsonResponse(estado, status=200 if sano else 503)
