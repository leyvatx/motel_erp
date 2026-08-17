"""Automatizacion de ama de llaves.

Cuando una habitación entra en estado CLEANING -- por check-out o al cerrar un
mantenimiento -- se levanta sola la tarea de limpieza. Recepción no tiene que
acordarse de crearla y el frontend no hace polling para enterarse.
"""

from __future__ import annotations

from django.dispatch import receiver

from apps.housekeeping.constants import CleaningTaskType
from apps.housekeeping.services import create_cleaning_task
from apps.rooms import signals as room_signals
from apps.rooms.constants import RoomStatus


@receiver(room_signals.room_status_changed, dispatch_uid="housekeeping_autocreate_task")
def on_room_needs_cleaning(sender, room, from_status, to_status, stay=None, actor=None, **kwargs):
    if to_status != RoomStatus.CLEANING:
        return

    task_type = (
        CleaningTaskType.PREVENTIVE
        if from_status in {RoomStatus.MAINTENANCE, RoomStatus.BLOCKED}
        else CleaningTaskType.CHECKOUT
    )
    create_cleaning_task(
        room=room,
        stay=stay,
        task_type=task_type,
        actor=actor,
        priority=50 if task_type == CleaningTaskType.CHECKOUT else 100,
    )
