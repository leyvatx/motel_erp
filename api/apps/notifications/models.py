"""Notificaciones persistentes del topbar.

Los consumers de Channels y los eventos de dominio se implementan en la
Fase 3; este modelo guarda el historial que el topbar consulta al cargar.
"""

from django.db import models

from common.models import BaseModel


class NotificationLevel(models.TextChoices):
    INFO = "INFO", "Informativa"
    WARNING = "WARNING", "Advertencia"
    CRITICAL = "CRITICAL", "Critica"


class NotificationCategory(models.TextChoices):
    STAY_EXPIRING = "STAY_EXPIRING", "Renta por vencer"
    STAY_EXPIRED = "STAY_EXPIRED", "Renta vencida"
    LOW_STOCK = "LOW_STOCK", "Stock mínimo"
    EXPIRING_LOT = "EXPIRING_LOT", "Producto por caducar"
    NEW_ORDER = "NEW_ORDER", "Nueva orden"
    CLEANING_TASK = "CLEANING_TASK", "Tarea de limpieza"
    MAINTENANCE = "MAINTENANCE", "Mantenimiento"
    EXPENSE_APPROVAL = "EXPENSE_APPROVAL", "Gasto por aprobar"
    SHIFT = "SHIFT", "Turno de caja"


class Notification(BaseModel):
    """Aviso dirigido a un rol o a un usuario concreto."""

    category = models.CharField(
        "Categoría", max_length=20, choices=NotificationCategory.choices, db_index=True
    )
    level = models.CharField(
        "Nivel", max_length=10, choices=NotificationLevel.choices, default=NotificationLevel.INFO
    )
    title = models.CharField("Titulo", max_length=120)
    body = models.CharField("Mensaje", max_length=255, blank=True)
    target_role = models.CharField(
        "Rol destino", max_length=20, blank=True, db_index=True,
        help_text="Vacio = todos los roles.",
    )
    target_user = models.ForeignKey(
        "users.User",
        verbose_name="Usuario destino",
        on_delete=models.PROTECT,
        related_name="notifications",
        null=True,
        blank=True,
    )
    payload = models.JSONField("Datos", default=dict, blank=True)
    read_at = models.DateTimeField("Leida en", null=True, blank=True)
    read_by = models.ForeignKey(
        "users.User",
        verbose_name="Leida por",
        on_delete=models.PROTECT,
        related_name="read_notifications",
        null=True,
        blank=True,
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_role", "-created_at"], name="notif_role_created_idx"),
            models.Index(fields=["category", "-created_at"], name="notif_category_idx"),
        ]

    def __str__(self) -> str:
        return f"[{self.get_level_display()}] {self.title}"
