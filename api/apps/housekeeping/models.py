"""Ama de llaves: tareas de limpieza y reportes de mantenimiento.

La tarea de limpieza se crea sola cuando una habitación entra en estado
CLEANING (evento de dominio, no polling). Los tiempos se miden con los sellos
``started_at`` / ``finished_at`` del servidor, nunca con el reloj del cliente.
"""

from __future__ import annotations

from django.db import models
from django.utils import timezone

from common.models import BaseModel, ImmutableModel
from common.utils import ZERO

from apps.housekeeping.constants import (
    CleaningTaskStatus,
    CleaningTaskType,
    MaintenanceCategory,
    MaintenancePriority,
    MaintenanceStatus,
)


class CleaningTask(BaseModel):
    """Tarea de limpieza de una habitación."""

    room = models.ForeignKey(
        "rooms.Room",
        verbose_name="Habitación",
        on_delete=models.PROTECT,
        related_name="cleaning_tasks",
    )
    stay = models.ForeignKey(
        "rooms.Stay",
        verbose_name="Renta que la originó",
        on_delete=models.PROTECT,
        related_name="cleaning_tasks",
        null=True,
        blank=True,
    )
    task_type = models.CharField(
        "Tipo", max_length=12, choices=CleaningTaskType.choices, default=CleaningTaskType.CHECKOUT
    )
    status = models.CharField(
        "Estado",
        max_length=12,
        choices=CleaningTaskStatus.choices,
        default=CleaningTaskStatus.PENDING,
        db_index=True,
    )
    priority = models.PositiveSmallIntegerField(
        "Prioridad", default=100, help_text="Menor número se atiende primero."
    )

    assigned_to = models.ForeignKey(
        "users.User",
        verbose_name="Asignada a",
        on_delete=models.PROTECT,
        related_name="cleaning_tasks",
        null=True,
        blank=True,
    )
    assigned_at = models.DateTimeField("Asignada en", null=True, blank=True)
    started_at = models.DateTimeField("Iniciada en", null=True, blank=True)
    finished_at = models.DateTimeField("Terminada en", null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(
        "Duración (segundos)", null=True, blank=True, editable=False
    )

    verified_by = models.ForeignKey(
        "users.User",
        verbose_name="Verificada por",
        on_delete=models.PROTECT,
        related_name="verified_cleaning_tasks",
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField("Verificada en", null=True, blank=True)

    notes = models.TextField("Notas", blank=True)
    found_issues = models.BooleanField("Reporto incidencias", default=False)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Tarea de limpieza"
        verbose_name_plural = "Tareas de limpieza"
        ordering = ["priority", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["room"],
                condition=models.Q(
                    status__in=[
                        CleaningTaskStatus.PENDING,
                        CleaningTaskStatus.ASSIGNED,
                        CleaningTaskStatus.IN_PROGRESS,
                    ]
                ),
                name="uniq_open_cleaning_task_per_room",
            )
        ]
        indexes = [
            models.Index(fields=["status", "priority"], name="cleaning_status_priority_idx"),
            models.Index(fields=["assigned_to", "status"], name="cleaning_assignee_idx"),
            models.Index(fields=["-finished_at"], name="cleaning_finished_idx"),
        ]

    def __str__(self) -> str:
        return f"Limpieza Hab. {self.room.number} ({self.get_status_display()})"

    @property
    def is_open(self) -> bool:
        return self.status in {
            CleaningTaskStatus.PENDING,
            CleaningTaskStatus.ASSIGNED,
            CleaningTaskStatus.IN_PROGRESS,
        }

    @property
    def elapsed_seconds(self) -> int | None:
        """Segundos transcurridos si la tarea está en proceso."""
        if self.started_at and not self.finished_at:
            return int((timezone.now() - self.started_at).total_seconds())
        return self.duration_seconds


class MaintenanceReport(BaseModel):
    """Reporte de mantenimiento con seguimiento hasta su resolución."""

    folio = models.CharField("Folio", max_length=25, unique=True, editable=False)
    room = models.ForeignKey(
        "rooms.Room",
        verbose_name="Habitación",
        on_delete=models.PROTECT,
        related_name="maintenance_reports",
        null=True,
        blank=True,
        help_text="Vacio si el reporte es de un área común.",
    )
    area = models.CharField("Area", max_length=80, blank=True)
    title = models.CharField("Titulo", max_length=120)
    description = models.TextField("Descripción")
    category = models.CharField(
        "Categoría",
        max_length=20,
        choices=MaintenanceCategory.choices,
        default=MaintenanceCategory.OTHER,
    )
    priority = models.CharField(
        "Prioridad",
        max_length=8,
        choices=MaintenancePriority.choices,
        default=MaintenancePriority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        "Estado",
        max_length=14,
        choices=MaintenanceStatus.choices,
        default=MaintenanceStatus.REPORTED,
        db_index=True,
    )
    blocks_room = models.BooleanField(
        "Deja la habitación fuera de servicio",
        default=False,
        help_text="Si se marca, la habitación pasa a mantenimiento hasta resolverse.",
    )

    reported_by = models.ForeignKey(
        "users.User",
        verbose_name="Reportado por",
        on_delete=models.PROTECT,
        related_name="maintenance_reports",
    )
    assigned_to = models.ForeignKey(
        "users.User",
        verbose_name="Asignado a",
        on_delete=models.PROTECT,
        related_name="assigned_maintenance",
        null=True,
        blank=True,
    )
    cleaning_task = models.ForeignKey(
        CleaningTask,
        verbose_name="Detectado durante la limpieza",
        on_delete=models.PROTECT,
        related_name="maintenance_reports",
        null=True,
        blank=True,
    )

    resolved_at = models.DateTimeField("Resuelto en", null=True, blank=True)
    resolved_by = models.ForeignKey(
        "users.User",
        verbose_name="Resuelto por",
        on_delete=models.PROTECT,
        related_name="resolved_maintenance",
        null=True,
        blank=True,
    )
    resolution_notes = models.TextField("Notas de resolución", blank=True)
    cost = models.DecimalField("Costo", max_digits=12, decimal_places=2, default=ZERO)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Reporte de mantenimiento"
        verbose_name_plural = "Reportes de mantenimiento"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"], name="maint_status_priority_idx"),
            models.Index(fields=["room", "status"], name="maint_room_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.folio} - {self.title}"

    @property
    def is_open(self) -> bool:
        return self.status in {
            MaintenanceStatus.REPORTED,
            MaintenanceStatus.ACKNOWLEDGED,
            MaintenanceStatus.IN_PROGRESS,
        }


class MaintenanceUpdate(ImmutableModel):
    """Nota de seguimiento del reporte. Historial inmutable."""

    report = models.ForeignKey(
        MaintenanceReport,
        verbose_name="Reporte",
        on_delete=models.PROTECT,
        related_name="updates",
    )
    note = models.TextField("Nota")
    status_before = models.CharField("Estado anterior", max_length=14, choices=MaintenanceStatus.choices)
    status_after = models.CharField("Estado nuevo", max_length=14, choices=MaintenanceStatus.choices)
    created_by = models.ForeignKey(
        "users.User",
        verbose_name="Registrado por",
        on_delete=models.PROTECT,
        related_name="maintenance_updates",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Seguimiento de mantenimiento"
        verbose_name_plural = "Seguimientos de mantenimiento"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["report", "created_at"], name="maint_update_report_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.report.folio}: {self.status_before} -> {self.status_after}"
