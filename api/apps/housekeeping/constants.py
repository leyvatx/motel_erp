"""Catalogos de ama de llaves y mantenimiento."""

from django.db import models


class CleaningTaskType(models.TextChoices):
    CHECKOUT = "CHECKOUT", "Salida de huesped"
    PREVENTIVE = "PREVENTIVE", "Mantenimiento preventivo"
    DEEP = "DEEP", "Limpieza profunda"
    INSPECTION = "INSPECTION", "Inspeccion"


class CleaningTaskStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    ASSIGNED = "ASSIGNED", "Asignada"
    IN_PROGRESS = "IN_PROGRESS", "En proceso"
    DONE = "DONE", "Terminada"
    VERIFIED = "VERIFIED", "Verificada"
    CANCELLED = "CANCELLED", "Cancelada"


class MaintenanceCategory(models.TextChoices):
    PLUMBING = "PLUMBING", "Plomería"
    ELECTRICAL = "ELECTRICAL", "Electricidad"
    AIR_CONDITIONING = "AIR_CONDITIONING", "Clima"
    FURNITURE = "FURNITURE", "Mobiliario"
    ELECTRONICS = "ELECTRONICS", "Televisión / electrónicos"
    STRUCTURE = "STRUCTURE", "Obra civil"
    OTHER = "OTHER", "Otro"


class MaintenancePriority(models.TextChoices):
    LOW = "LOW", "Baja"
    MEDIUM = "MEDIUM", "Media"
    HIGH = "HIGH", "Alta"
    URGENT = "URGENT", "Urgente"


class MaintenanceStatus(models.TextChoices):
    REPORTED = "REPORTED", "Reportado"
    ACKNOWLEDGED = "ACKNOWLEDGED", "Recibido"
    IN_PROGRESS = "IN_PROGRESS", "En atención"
    RESOLVED = "RESOLVED", "Resuelto"
    CANCELLED = "CANCELLED", "Cancelado"


#: Transiciones válidas del reporte de mantenimiento.
MAINTENANCE_TRANSITIONS: dict[str, frozenset[str]] = {
    MaintenanceStatus.REPORTED: frozenset(
        {MaintenanceStatus.ACKNOWLEDGED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED}
    ),
    MaintenanceStatus.ACKNOWLEDGED: frozenset(
        {MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED}
    ),
    MaintenanceStatus.IN_PROGRESS: frozenset(
        {MaintenanceStatus.RESOLVED, MaintenanceStatus.CANCELLED}
    ),
    MaintenanceStatus.RESOLVED: frozenset(),
    MaintenanceStatus.CANCELLED: frozenset(),
}

#: Transiciones válidas de la tarea de limpieza.
CLEANING_TRANSITIONS: dict[str, frozenset[str]] = {
    CleaningTaskStatus.PENDING: frozenset(
        {CleaningTaskStatus.ASSIGNED, CleaningTaskStatus.IN_PROGRESS, CleaningTaskStatus.CANCELLED}
    ),
    CleaningTaskStatus.ASSIGNED: frozenset(
        {CleaningTaskStatus.IN_PROGRESS, CleaningTaskStatus.PENDING, CleaningTaskStatus.CANCELLED}
    ),
    CleaningTaskStatus.IN_PROGRESS: frozenset(
        {CleaningTaskStatus.DONE, CleaningTaskStatus.CANCELLED}
    ),
    CleaningTaskStatus.DONE: frozenset({CleaningTaskStatus.VERIFIED}),
    CleaningTaskStatus.VERIFIED: frozenset(),
    CleaningTaskStatus.CANCELLED: frozenset(),
}
