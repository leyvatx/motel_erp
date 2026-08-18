"""Tareas periódicas de recepción.

El cronómetro de cada cuarto no vive en el navegador: esta tarea corre cada
30 segundos, detecta las rentas por vencer y las vencidas, y empuja el aviso
por WebSocket. El frontend solo pinta la cuenta regresiva a partir de
``expires_at``, de modo que recargar la página no altera ningun tiempo.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.notifications.events import Event, broadcast, role_group, stay_payload
from apps.notifications.models import NotificationCategory, NotificationLevel
from apps.notifications.services import notify
from apps.rooms.constants import StayStatus
from apps.rooms.models import Stay
from apps.settings.models import Motel
from apps.users.constants import Role
from common.tenancy import use_motel

logger = logging.getLogger(__name__)


def _stays_to_process(queryset, limit: int = 200) -> list[Stay]:
    """Bloquea las filas que va a procesar y deja pasar de largo las tomadas.

    ``skip_locked`` evita que dos ejecuciones solapadas del beat avisen dos
    veces de la misma renta.
    """
    return list(
        queryset.select_for_update(skip_locked=True, of=("self",))
        .select_related("room")
        .order_by("expires_at")[:limit]
    )


@shared_task(name="apps.rooms.tasks.dispatch_stay_timer_sweeps", ignore_result=True)
def dispatch_stay_timer_sweeps() -> int:
    motel_ids = list(Motel.objects.values_list("pk", flat=True))
    for motel_id in motel_ids:
        sweep_stay_timers.apply_async(args=[motel_id], expires=25)
    return len(motel_ids)


@shared_task(name="apps.rooms.tasks.sweep_stay_timers", ignore_result=True)
def sweep_stay_timers(motel_id: int) -> dict[str, int]:
    with use_motel(motel_id):
        return _sweep_stay_timers()


def _sweep_stay_timers() -> dict[str, int]:
    """Detecta cronómetros por vencer y vencidos, y emite sus eventos."""
    now = timezone.now()
    warning_limit = now + timedelta(minutes=Motel.current().expiration_warning_minutes)
    warned = 0
    expired = 0

    with transaction.atomic():
        stays = _stays_to_process(
            Stay.objects.filter(
                status=StayStatus.ACTIVE,
                is_active=True,
                expires_at__lte=warning_limit,
                expires_at__gt=now,
                warning_notified_at__isnull=True,
            )
        )
        for stay in stays:
            stay.warning_notified_at = now
            stay.save(update_fields=["warning_notified_at", "updated_at"])

            payload = stay_payload(stay)
            broadcast(Event.STAY_EXPIRING, payload, motel=stay.motel_id)
            notify(
                category=NotificationCategory.STAY_EXPIRING,
                level=NotificationLevel.WARNING,
                title=f"Habitacion {stay.room.number} por vencer",
                body=f"Quedan {max(stay.remaining_seconds // 60, 0)} minutos de la renta {stay.code}.",
                target_role=Role.RECEPTION,
                payload=payload,
            )
            warned += 1

    with transaction.atomic():
        stays = _stays_to_process(
            Stay.objects.filter(
                status=StayStatus.ACTIVE,
                is_active=True,
                expires_at__lte=now,
                expired_notified_at__isnull=True,
            )
        )
        for stay in stays:
            stay.expired_notified_at = now
            if stay.warning_notified_at is None:
                stay.warning_notified_at = now
            stay.save(
                update_fields=["expired_notified_at", "warning_notified_at", "updated_at"]
            )

            payload = stay_payload(stay)
            broadcast(Event.STAY_EXPIRED, payload, motel=stay.motel_id)
            notify(
                category=NotificationCategory.STAY_EXPIRED,
                level=NotificationLevel.CRITICAL,
                title=f"Habitacion {stay.room.number} vencida",
                body=f"La renta {stay.code} agoto su tiempo.",
                target_role=Role.RECEPTION,
                payload=payload,
            )
            expired += 1

    if warned or expired:
        logger.info("Barrido de cronómetros: %s por vencer, %s vencidas", warned, expired)
    return {"warned": warned, "expired": expired}


@shared_task(name="apps.rooms.tasks.dispatch_reservation_expirations", ignore_result=True)
def dispatch_reservation_expirations(grace_minutes: int = 60) -> int:
    motel_ids = list(Motel.objects.values_list("pk", flat=True))
    for motel_id in motel_ids:
        expire_stale_reservations.apply_async(
            args=[motel_id, grace_minutes],
            expires=9 * 60,
        )
    return len(motel_ids)


@shared_task(name="apps.rooms.tasks.expire_stale_reservations", ignore_result=True)
def expire_stale_reservations(motel_id: int, grace_minutes: int = 60) -> int:
    with use_motel(motel_id):
        return _expire_stale_reservations(grace_minutes)


def _expire_stale_reservations(grace_minutes: int = 60) -> int:
    """Marca como NO_SHOW las reservaciones que nadie ocupo.

    Libera la habitación reservada para que recepción pueda volver a venderla.
    """
    from apps.rooms.constants import ReservationStatus, RoomStatus
    from apps.rooms.models import Reservation, Room
    from apps.rooms.services import transition_room

    cutoff = timezone.now() - timedelta(minutes=grace_minutes)
    count = 0

    with transaction.atomic():
        reservations = list(
            Reservation.objects.select_for_update(skip_locked=True, of=("self",))
            .filter(
                is_active=True,
                status__in=[ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
                scheduled_start__lt=cutoff,
            )
            .select_related("room")[:100]
        )
        for reservation in reservations:
            reservation.status = ReservationStatus.NO_SHOW
            reservation.save(update_fields=["status", "updated_at"])

            if reservation.room_id and reservation.room.status == RoomStatus.RESERVED:
                room = Room.objects.select_for_update().get(pk=reservation.room_id)
                transition_room(
                    room,
                    RoomStatus.AVAILABLE,
                    reason=f"Reservacion {reservation.code} sin presentarse",
                )
            count += 1

    if count:
        logger.info("Reservaciones marcadas como no-show: %s", count)
    return count
