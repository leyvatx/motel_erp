"""Capa de servicios de ama de llaves y mantenimiento."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from common.exceptions import DomainError, InvalidStateTransition
from common.models import DocumentSequence
from common.utils import ZERO, period_key

from apps.housekeeping.constants import (
    CLEANING_TRANSITIONS,
    CleaningTaskStatus,
    CleaningTaskType,
    MAINTENANCE_TRANSITIONS,
    MaintenanceStatus,
)
from apps.housekeeping.models import CleaningTask, MaintenanceReport, MaintenanceUpdate
from apps.rooms.constants import RoomStatus, StayStatus
from apps.rooms.models import Room
from apps.rooms.services import transition_room

OPEN_CLEANING_STATUSES = (
    CleaningTaskStatus.PENDING,
    CleaningTaskStatus.ASSIGNED,
    CleaningTaskStatus.IN_PROGRESS,
)


def _validate_cleaning_transition(current: str, target: str) -> None:
    if target not in CLEANING_TRANSITIONS.get(current, frozenset()):
        raise InvalidStateTransition(
            detail=(
                f"No se permite pasar la tarea de "
                f"'{CleaningTaskStatus(current).label}' a '{CleaningTaskStatus(target).label}'."
            ),
            current_status=current,
            target_status=target,
        )


@transaction.atomic
def create_cleaning_task(
    *,
    room: Room,
    stay=None,
    task_type: str = CleaningTaskType.CHECKOUT,
    actor=None,
    priority: int = 100,
    notes: str = "",
) -> CleaningTask:
    """Crea la tarea de limpieza de una habitación.

    Es idempotente: si ya hay una tarea abierta para ese cuarto la devuelve,
    de modo que un doble evento no genere trabajo duplicado.
    """
    existente = CleaningTask.objects.filter(
        room=room, status__in=OPEN_CLEANING_STATUSES
    ).first()
    if existente is not None:
        return existente

    return CleaningTask.objects.create(
        room=room,
        stay=stay,
        task_type=task_type,
        priority=priority,
        notes=notes,
        created_by=actor,
    )


@transaction.atomic
def assign_cleaning_task(*, task_id: int, employee, actor) -> CleaningTask:
    task = CleaningTask.objects.select_for_update().get(pk=task_id, is_active=True)
    _validate_cleaning_transition(task.status, CleaningTaskStatus.ASSIGNED)

    task.status = CleaningTaskStatus.ASSIGNED
    task.assigned_to = employee
    task.assigned_at = timezone.now()
    task.updated_by = actor
    task.save(update_fields=["status", "assigned_to", "assigned_at", "updated_by", "updated_at"])
    return task


@transaction.atomic
def start_cleaning_task(*, task_id: int, actor) -> CleaningTask:
    """Arranca el cronómetro de la limpieza. El sello lo pone el servidor."""
    task = CleaningTask.objects.select_for_update().get(pk=task_id, is_active=True)
    _validate_cleaning_transition(task.status, CleaningTaskStatus.IN_PROGRESS)

    task.status = CleaningTaskStatus.IN_PROGRESS
    task.started_at = timezone.now()
    if task.assigned_to_id is None:
        task.assigned_to = actor
        task.assigned_at = task.started_at
    task.updated_by = actor
    task.save(
        update_fields=[
            "status",
            "started_at",
            "assigned_to",
            "assigned_at",
            "updated_by",
            "updated_at",
        ]
    )
    return task


@transaction.atomic
def finish_cleaning_task(
    *, task_id: int, actor, notes: str = "", found_issues: bool = False
) -> CleaningTask:
    """Cierra la limpieza, mide el tiempo y libera la habitación.

    Si el cuarto quedó fuera de servicio por un reporte de mantenimiento, no
    se libera: primero hay que resolver el reporte.
    """
    task = (
        CleaningTask.objects.select_for_update(of=("self",))
        .select_related("room")
        .get(pk=task_id, is_active=True)
    )
    _validate_cleaning_transition(task.status, CleaningTaskStatus.DONE)

    now = timezone.now()
    task.status = CleaningTaskStatus.DONE
    task.finished_at = now
    task.duration_seconds = (
        int((now - task.started_at).total_seconds()) if task.started_at else 0
    )
    task.notes = (f"{task.notes}\n{notes}".strip() if notes else task.notes)[:2000]
    task.found_issues = found_issues
    task.updated_by = actor
    task.save(
        update_fields=[
            "status",
            "finished_at",
            "duration_seconds",
            "notes",
            "found_issues",
            "updated_by",
            "updated_at",
        ]
    )

    room = Room.objects.select_for_update().get(pk=task.room_id)
    if room.status == RoomStatus.CLEANING:
        transition_room(
            room,
            RoomStatus.AVAILABLE,
            actor=actor,
            reason=f"Limpieza terminada ({task.duration_seconds // 60} min)",
        )
    return task


@transaction.atomic
def verify_cleaning_task(*, task_id: int, actor) -> CleaningTask:
    task = CleaningTask.objects.select_for_update().get(pk=task_id, is_active=True)
    _validate_cleaning_transition(task.status, CleaningTaskStatus.VERIFIED)

    task.status = CleaningTaskStatus.VERIFIED
    task.verified_by = actor
    task.verified_at = timezone.now()
    task.updated_by = actor
    task.save(update_fields=["status", "verified_by", "verified_at", "updated_by", "updated_at"])
    return task


@transaction.atomic
def cancel_cleaning_task(*, task_id: int, reason: str, actor) -> CleaningTask:
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    task = CleaningTask.objects.select_for_update().get(pk=task_id, is_active=True)
    _validate_cleaning_transition(task.status, CleaningTaskStatus.CANCELLED)

    task.status = CleaningTaskStatus.CANCELLED
    task.cancellation_reason = reason[:255]
    task.updated_by = actor
    task.save(update_fields=["status", "cancellation_reason", "updated_by", "updated_at"])
    return task


@transaction.atomic
def report_maintenance(
    *,
    title: str,
    description: str,
    actor,
    room_id: int | None = None,
    area: str = "",
    category: str = "",
    priority: str = "",
    blocks_room: bool = False,
    cleaning_task_id: int | None = None,
) -> MaintenanceReport:
    """Levanta un reporte y, si procede, saca la habitación de servicio."""
    from apps.housekeeping.constants import MaintenanceCategory, MaintenancePriority

    room = None
    if room_id:
        room = Room.objects.select_for_update().get(pk=room_id, is_active=True)
        if blocks_room and room.stays.filter(status=StayStatus.ACTIVE).exists():
            raise DomainError(
                "La habitación tiene una renta activa: no se puede bloquear todavía.",
                code="room_occupied",
            )

    report = MaintenanceReport.objects.create(
        folio=DocumentSequence.next_value("maintenance", "MTO", period_key()),
        room=room,
        area=area,
        title=title[:120],
        description=description,
        category=category or MaintenanceCategory.OTHER,
        priority=priority or MaintenancePriority.MEDIUM,
        blocks_room=blocks_room,
        reported_by=actor,
        cleaning_task_id=cleaning_task_id,
        created_by=actor,
    )

    MaintenanceUpdate.objects.create(
        report=report,
        note=f"Reporte levantado: {title}"[:500],
        status_before=MaintenanceStatus.REPORTED,
        status_after=MaintenanceStatus.REPORTED,
        created_by=actor,
    )

    if room is not None and blocks_room and room.status != RoomStatus.MAINTENANCE:
        transition_room(
            room,
            RoomStatus.MAINTENANCE,
            actor=actor,
            reason=f"Reporte {report.folio}: {title}"[:255],
        )

    _broadcast_maintenance(report)
    return report


def _broadcast_maintenance(report: MaintenanceReport) -> None:
    from apps.notifications.events import Event, broadcast, role_group
    from apps.notifications.models import NotificationCategory, NotificationLevel
    from apps.notifications.services import notify
    from apps.housekeeping.constants import MaintenancePriority
    from apps.users.constants import Role

    payload = {
        "report_id": report.pk,
        "folio": report.folio,
        "room_id": report.room_id,
        "room_number": report.room.number if report.room_id else None,
        "title": report.title,
        "priority": report.priority,
        "status": report.status,
        "blocks_room": report.blocks_room,
    }
    broadcast(
        Event.MAINTENANCE_REPORTED,
        payload,
        motel=report.motel_id,
        groups=[
            role_group(Role.MANAGER, report.motel_id),
            role_group(Role.HOUSEKEEPING, report.motel_id),
        ],
    )
    notify(
        category=NotificationCategory.MAINTENANCE,
        level=(
            NotificationLevel.CRITICAL
            if report.priority == MaintenancePriority.URGENT
            else NotificationLevel.WARNING
        ),
        title=f"Mantenimiento {report.folio}",
        body=(
            f"{report.title}"
            + (f" (Hab. {report.room.number})" if report.room_id else "")
        ),
        target_role=Role.MANAGER,
        payload=payload,
        actor=report.reported_by,
    )


@transaction.atomic
def update_maintenance_status(
    *,
    report_id: int,
    new_status: str,
    actor,
    note: str = "",
    assigned_to=None,
    resolution_notes: str = "",
    cost: Decimal = ZERO,
    release_room: bool = True,
) -> MaintenanceReport:
    """Avanza el reporte por su flujo y deja constancia del seguimiento."""
    report = (
        MaintenanceReport.objects.select_for_update(of=("self",))
        .select_related("room")
        .get(pk=report_id, is_active=True)
    )
    previous = report.status
    if new_status not in MAINTENANCE_TRANSITIONS.get(previous, frozenset()):
        raise InvalidStateTransition(
            detail=(
                f"No se permite pasar el reporte de "
                f"'{MaintenanceStatus(previous).label}' a '{MaintenanceStatus(new_status).label}'."
            ),
            current_status=previous,
            target_status=new_status,
        )
    if new_status == MaintenanceStatus.CANCELLED and not note:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    report.status = new_status
    if assigned_to is not None:
        report.assigned_to = assigned_to
    if new_status == MaintenanceStatus.RESOLVED:
        report.resolved_at = timezone.now()
        report.resolved_by = actor
        report.resolution_notes = resolution_notes
        report.cost = cost or ZERO
    if new_status == MaintenanceStatus.CANCELLED:
        report.cancellation_reason = note[:255]
    report.updated_by = actor
    report.save(
        update_fields=[
            "status",
            "assigned_to",
            "resolved_at",
            "resolved_by",
            "resolution_notes",
            "cost",
            "cancellation_reason",
            "updated_by",
            "updated_at",
        ]
    )

    MaintenanceUpdate.objects.create(
        report=report,
        note=note or f"Cambio de estado a {MaintenanceStatus(new_status).label}",
        status_before=previous,
        status_after=new_status,
        created_by=actor,
    )

    cerrado = new_status in {MaintenanceStatus.RESOLVED, MaintenanceStatus.CANCELLED}
    if cerrado and release_room and report.room_id and report.blocks_room:
        room = Room.objects.select_for_update().get(pk=report.room_id)
        otros_bloqueos = (
            MaintenanceReport.objects.filter(
                room_id=room.pk,
                blocks_room=True,
                is_active=True,
                status__in=[
                    MaintenanceStatus.REPORTED,
                    MaintenanceStatus.ACKNOWLEDGED,
                    MaintenanceStatus.IN_PROGRESS,
                ],
            )
            .exclude(pk=report.pk)
            .exists()
        )
        if not otros_bloqueos and room.status == RoomStatus.MAINTENANCE:
            transition_room(
                room,
                RoomStatus.CLEANING,
                actor=actor,
                reason=f"Reporte {report.folio} cerrado",
            )
    return report
