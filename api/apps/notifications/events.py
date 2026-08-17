"""Bus de eventos en tiempo real sobre el channel layer de Redis.

Reglas:
* Los eventos se emiten **después** del commit (``transaction.on_commit``):
  el frontend nunca se entera de algo que la base de datos todavía no acepto.
* Si Redis no responde, se registra la falla pero no se tumba la operación de
  negocio: un cobro no puede fallar porque el WebSocket este caido.
"""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

#: Grupo del grid de recepción (cuartos, cronómetros, rentas).
GROUP_FRONTDESK = "frontdesk"
#: Grupo del topbar de notificaciones.
GROUP_NOTIFICATIONS = "notifications"
#: Grupo de ordenes / room service.
GROUP_ORDERS = "orders"


def role_group(role: str) -> str:
    return f"role.{role.lower()}"


def user_group(user_id: int) -> str:
    return f"user.{user_id}"


class Event:
    """Nombres de evento que consume el frontend."""

    ROOM_STATUS_CHANGED = "room.status_changed"
    STAY_STARTED = "stay.started"
    STAY_EXTENDED = "stay.extended"
    STAY_CLOSED = "stay.closed"
    STAY_CANCELLED = "stay.cancelled"
    STAY_EXPIRING = "stay.expiring"
    STAY_EXPIRED = "stay.expired"
    ORDER_CREATED = "order.created"
    ORDER_DELIVERED = "order.delivered"
    ORDER_CANCELLED = "order.cancelled"
    CLEANING_TASK = "housekeeping.task"
    MAINTENANCE_REPORTED = "maintenance.reported"
    STOCK_LOW = "inventory.low_stock"
    STOCK_EXPIRING = "inventory.expiring_lot"
    NOTIFICATION_NEW = "notification.new"
    SHIFT_CHANGED = "finances.shift_changed"


def _send_now(groups: list[str], event: str, payload: dict[str, Any]) -> None:
    layer = get_channel_layer()
    if layer is None:  # pragma: no cover - solo si no hay CHANNEL_LAYERS
        logger.warning("Sin channel layer configurado; se omite el evento %s", event)
        return

    message = {
        "type": "broadcast.event",
        "event": event,
        "payload": payload,
        "timestamp": timezone.now().isoformat(),
    }
    for group in groups:
        try:
            async_to_sync(layer.group_send)(group, message)
        except Exception:  # noqa: BLE001 - el negocio no depende del WebSocket
            logger.exception("No se pudo emitir '%s' al grupo '%s'", event, group)


def broadcast(
    event: str,
    payload: dict[str, Any],
    *,
    groups: list[str] | None = None,
    immediate: bool = False,
) -> None:
    """Publica un evento a los grupos indicados (por defecto, recepción)."""
    targets = groups or [GROUP_FRONTDESK]
    if immediate:
        _send_now(targets, event, payload)
    else:
        transaction.on_commit(lambda: _send_now(targets, event, payload))


# ---------------------------------------------------------------------------
# Serializacion ligera para los eventos (no se reusa DRF para no acoplar)
# ---------------------------------------------------------------------------
def room_payload(room, stay=None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "room_id": room.pk,
        "number": room.number,
        "status": room.status,
        "status_changed_at": room.status_changed_at.isoformat() if room.status_changed_at else None,
        "room_type_id": room.room_type_id,
        "stay": None,
    }
    if stay is not None:
        data["stay"] = stay_payload(stay)
    return data


def stay_payload(stay) -> dict[str, Any]:
    return {
        "stay_id": stay.pk,
        "code": stay.code,
        "room_id": stay.room_id,
        "room_number": stay.room.number if stay.room_id else None,
        "status": stay.status,
        "check_in_at": stay.check_in_at.isoformat(),
        "expires_at": stay.expires_at.isoformat(),
        "remaining_seconds": stay.remaining_seconds,
        "vehicle_plate": stay.vehicle_plate,
        "guest_name": stay.guest_name,
    }


def order_payload(order) -> dict[str, Any]:
    return {
        "order_id": order.pk,
        "code": order.code,
        "folio_id": order.folio_id,
        "room_number": order.folio.room.number if order.folio.room_id else None,
        "order_type": order.order_type,
        "status": order.status,
        "total": str(order.total),
        "items": order.items.count(),
    }


def notification_payload(notification) -> dict[str, Any]:
    return {
        "id": notification.pk,
        "category": notification.category,
        "level": notification.level,
        "title": notification.title,
        "body": notification.body,
        "payload": notification.payload,
        "created_at": notification.created_at.isoformat(),
    }
