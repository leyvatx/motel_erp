"""Suscripciones a las señales de dominio.

El modulo de habitaciones no sabe que existen los WebSockets: emite señales y
es esta app la que las traduce a eventos en tiempo real. Así el día que se
agregue otro canal (push, correo) no se toca la capa de recepción.
"""

from __future__ import annotations

from django.dispatch import receiver

from apps.notifications.events import (
    GROUP_FRONTDESK,
    GROUP_ORDERS,
    Event,
    broadcast,
    role_group,
    room_payload,
    stay_payload,
)
from apps.rooms import signals as room_signals
from apps.rooms.constants import RoomStatus
from apps.sales import signals as sales_signals
from apps.users.constants import Role


@receiver(room_signals.room_status_changed, dispatch_uid="notify_room_status_changed")
def on_room_status_changed(sender, room, from_status, to_status, stay=None, actor=None, **kwargs):
    broadcast(
        Event.ROOM_STATUS_CHANGED,
        {
            **room_payload(room, stay if to_status == RoomStatus.OCCUPIED else None),
            "from_status": from_status,
            "to_status": to_status,
        },
    )
    if to_status == RoomStatus.CLEANING:
        broadcast(
            Event.CLEANING_TASK,
            {"room_id": room.pk, "number": room.number, "status": to_status},
            groups=[role_group(Role.HOUSEKEEPING), GROUP_FRONTDESK],
        )


@receiver(room_signals.stay_started, dispatch_uid="notify_stay_started")
def on_stay_started(sender, stay, actor=None, **kwargs):
    broadcast(Event.STAY_STARTED, stay_payload(stay))


@receiver(room_signals.stay_extended, dispatch_uid="notify_stay_extended")
def on_stay_extended(sender, stay, extension, actor=None, **kwargs):
    payload = stay_payload(stay)
    payload["added_minutes"] = extension.minutes
    broadcast(Event.STAY_EXTENDED, payload)


@receiver(room_signals.stay_closed, dispatch_uid="notify_stay_closed")
def on_stay_closed(sender, stay, actor=None, **kwargs):
    broadcast(Event.STAY_CLOSED, stay_payload(stay))


@receiver(room_signals.stay_cancelled, dispatch_uid="notify_stay_cancelled")
def on_stay_cancelled(sender, stay, reason="", actor=None, **kwargs):
    payload = stay_payload(stay)
    payload["reason"] = reason
    broadcast(Event.STAY_CANCELLED, payload)


@receiver(sales_signals.order_created, dispatch_uid="notify_order_created")
def on_order_created(sender, order, actor=None, **kwargs):
    from apps.notifications.events import order_payload

    broadcast(
        Event.ORDER_CREATED, order_payload(order), groups=[GROUP_ORDERS, GROUP_FRONTDESK]
    )


@receiver(sales_signals.order_delivered, dispatch_uid="notify_order_delivered")
def on_order_delivered(sender, order, actor=None, **kwargs):
    from apps.notifications.events import order_payload

    broadcast(
        Event.ORDER_DELIVERED, order_payload(order), groups=[GROUP_ORDERS, GROUP_FRONTDESK]
    )


@receiver(sales_signals.order_cancelled, dispatch_uid="notify_order_cancelled")
def on_order_cancelled(sender, order, reason="", actor=None, **kwargs):
    from apps.notifications.events import order_payload

    payload = order_payload(order)
    payload["reason"] = reason
    broadcast(Event.ORDER_CANCELLED, payload, groups=[GROUP_ORDERS, GROUP_FRONTDESK])
