"""Servicio de presencia: quién está conectado y desde cuándo.

Lo alimenta el WebSocket, no el HTTP: una pestaña abierta mantiene el socket
vivo y eso es la mejor señal de que la persona sigue en su puesto. Cada
cambio de estado se difunde para que el resto de la recepción lo vea sin
recargar.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from apps.users.models import User, UserPresence


def _broadcast(presence: UserPresence, *, online: bool) -> None:
    from apps.notifications.events import GROUP_NOTIFICATIONS, broadcast

    broadcast(
        "presence.changed",
        {
            "user_id": presence.user_id,
            "username": presence.user.username,
            "full_name": presence.user.full_name,
            "role": presence.user.role,
            "is_online": online,
            "last_seen_at": presence.last_seen_at.isoformat() if presence.last_seen_at else None,
        },
        groups=[GROUP_NOTIFICATIONS],
        immediate=True,
    )


@transaction.atomic
def mark_connected(user: User) -> UserPresence:
    """Suma un socket. Difunde solo cuando la persona pasa de fuera a dentro."""
    presence, _ = UserPresence.objects.get_or_create(user=user)
    presence = UserPresence.objects.select_for_update().get(pk=presence.pk)

    estaba_dentro = presence.is_online
    presence.connections = F("connections") + 1
    presence.last_seen_at = timezone.now()
    presence.save(update_fields=["connections", "last_seen_at", "updated_at"])
    presence.refresh_from_db()

    if not estaba_dentro:
        _broadcast(presence, online=True)
    return presence


@transaction.atomic
def mark_disconnected(user: User) -> UserPresence | None:
    """Resta un socket y avisa cuando ya no queda ninguno abierto."""
    presence = UserPresence.objects.select_for_update().filter(user=user).first()
    if presence is None:
        return None

    presence.connections = max(presence.connections - 1, 0)
    presence.last_seen_at = timezone.now()
    presence.save(update_fields=["connections", "last_seen_at", "updated_at"])

    if presence.connections == 0:
        _broadcast(presence, online=False)
    return presence


def touch(user: User, section: str = "") -> None:
    """Refresca la marca de vida con cada ping del cliente.

    Sin esto, un servidor que se cae dejaría a todos "conectados" para
    siempre: ``is_online`` exige señal reciente, no solo contador en alto.
    """
    updates: dict[str, object] = {"last_seen_at": timezone.now()}
    if section:
        updates["last_section"] = section[:40]
    UserPresence.objects.filter(user=user).update(**updates)


#: Segundos mínimos entre dos actualizaciones de "visto por última vez".
TOUCH_THROTTLE_SECONDS = 60


def touch_if_stale(user: User) -> None:
    """Marca actividad desde peticiones HTTP, sin escribir en cada request.

    El WebSocket cubre "está conectado"; esto cubre "estuvo trabajando":
    aunque se le caiga el socket, el sistema sabe que hace dos minutos
    seguía cobrando.
    """
    corte = timezone.now() - timezone.timedelta(seconds=TOUCH_THROTTLE_SECONDS)
    actualizados = UserPresence.objects.filter(user=user, last_seen_at__lt=corte).update(
        last_seen_at=timezone.now()
    )
    if actualizados == 0:
        UserPresence.objects.get_or_create(
            user=user, defaults={"last_seen_at": timezone.now()}
        )


def roster() -> QuerySet[UserPresence]:
    """Plantilla vigente con su estado de conexión."""
    return (
        UserPresence.objects.select_related("user")
        .filter(user__is_active=True)
        .order_by("-last_seen_at")
    )


def ensure_rows() -> None:
    """Crea la fila de presencia de los usuarios que aún no la tienen."""
    faltantes = User.objects.filter(is_active=True, presence__isnull=True)
    UserPresence.objects.bulk_create(
        [UserPresence(user=user) for user in faltantes], ignore_conflicts=True
    )
