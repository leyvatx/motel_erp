"""Bitácora de auditoría.

Un renglón por operación sensible: quién, qué, cuándo, desde dónde y los
valores antes y después. El modelo es inmutable: no admite update ni delete,
ni siquiera desde el admin de Django.
"""

from __future__ import annotations

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from common.models import ImmutableModel

from apps.audit.constants import AuditAction, AuditModule


class AuditLog(ImmutableModel):
    actor = models.ForeignKey(
        "users.User",
        verbose_name="Usuario",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
        help_text="Vacio cuando la acción la ejecuta una tarea automática.",
    )
    actor_username = models.CharField(
        "Usuario (snapshot)",
        max_length=40,
        blank=True,
        help_text="Se guarda aparte para que la bitácora sobreviva cambios de nombre.",
    )
    action = models.CharField("Acción", max_length=20, choices=AuditAction.choices, db_index=True)
    module = models.CharField(
        "Modulo", max_length=14, choices=AuditModule.choices, db_index=True
    )
    description = models.CharField("Descripción", max_length=255, blank=True)

    content_type = models.ForeignKey(
        ContentType, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    object_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("content_type", "object_id")
    object_repr = models.CharField("Objeto", max_length=180, blank=True)

    changes = models.JSONField(
        "Cambios",
        default=dict,
        blank=True,
        help_text='Formato {"campo": {"before": ..., "after": ...}}.',
    )
    extra = models.JSONField("Datos adicionales", default=dict, blank=True)

    ip_address = models.GenericIPAddressField("IP", null=True, blank=True)
    user_agent = models.CharField("Agente", max_length=255, blank=True)

    class Meta:
        verbose_name = "Registro de auditoría"
        verbose_name_plural = "Bitácora de auditoría"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["-created_at"], name="audit_created_idx"),
            models.Index(fields=["actor", "-created_at"], name="audit_actor_idx"),
            models.Index(fields=["module", "action", "-created_at"], name="audit_module_idx"),
            models.Index(fields=["content_type", "object_id"], name="audit_target_idx"),
        ]

    def __str__(self) -> str:
        actor = self.actor_username or "sistema"
        return f"{self.created_at:%Y-%m-%d %H:%M} {actor}: {self.get_action_display()}"
