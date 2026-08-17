"""Modelos abstractos transversales.

Reglas que imponen estas bases:
* Ningun modelo de negocio se borra fisicamente (soft delete obligatorio).
* Todo registro guarda cuándo y quién lo creó / modifico.
* Los modelos marcados como inmutables (Kardex, AuditLog) rechazan updates.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from common.exceptions import ImmutableRecordError
from common.managers import ActiveManager, AllObjectsManager


class TimeStampedModel(models.Model):
    """Marcas de tiempo en UTC."""

    created_at = models.DateTimeField(
        "Creado en", auto_now_add=True, db_index=True, editable=False
    )
    updated_at = models.DateTimeField("Actualizado en", auto_now=True, editable=False)

    class Meta:
        abstract = True


class AuthorStampedModel(models.Model):
    """Autoria de creacion / última modificación."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="Creado por",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="Actualizado por",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Borrado lógico. Prohibido ejecutar DELETE sobre estas tablas."""

    is_active = models.BooleanField("Vigente", default=True, db_index=True)
    deleted_at = models.DateTimeField("Desactivado en", null=True, blank=True, editable=False)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="Desactivado por",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )
    deletion_reason = models.CharField("Motivo de baja", max_length=255, blank=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        # Las relaciones ForeignKey hacía adelante deben poder resolver
        # registros dados de baja; de lo contrario reventarian los reportes.
        base_manager_name = "all_objects"

    def delete(self, using=None, keep_parents=False, user=None, reason: str = ""):
        """Intercepta el borrado físico y lo convierte en baja lógica."""
        self.soft_delete(user=user, reason=reason, using=using)

    def soft_delete(self, user=None, reason: str = "", using=None) -> None:
        self.is_active = False
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.deletion_reason = reason
        self.save(
            using=using,
            update_fields=["is_active", "deleted_at", "deleted_by", "deletion_reason", "updated_at"],
        )

    def restore(self, using=None) -> None:
        self.is_active = True
        self.deleted_at = None
        self.deleted_by = None
        self.deletion_reason = ""
        self.save(
            using=using,
            update_fields=["is_active", "deleted_at", "deleted_by", "deletion_reason", "updated_at"],
        )

    def hard_delete(self, using=None, keep_parents=False):
        """Borrado físico explicito. Reservado para mantenimiento y tests."""
        return super().delete(using=using, keep_parents=keep_parents)


class BaseModel(TimeStampedModel, AuthorStampedModel, SoftDeleteModel):
    """Base estándar para entidades de negocio."""

    class Meta(SoftDeleteModel.Meta):
        abstract = True


class ImmutableModel(TimeStampedModel):
    """Registro de solo-escritura: se crea una vez y jamás se altera.

    Se usa en el Kardex de inventario y en la bitácora de auditoría, donde
    modificar un renglón destruiria la trazabilidad.
    """

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.pk is not None and not self._state.adding:
            raise ImmutableRecordError(
                f"{self.__class__.__name__} es inmutable: no admite modificaciones."
            )
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError(
            f"{self.__class__.__name__} es inmutable: no admite borrado."
        )


class DocumentSequence(models.Model):
    """Folios consecutivos seguros ante concurrencia.

    Se bloquea el renglón con ``select_for_update`` para que dos recepcionistas
    no generen el mismo consecutivo al rentar al mismo tiempo.
    """

    key = models.CharField("Clave", max_length=40)
    period_key = models.CharField("Periodo", max_length=20, blank=True)
    prefix = models.CharField("Prefijo", max_length=10)
    current_number = models.PositiveIntegerField("Consecutivo actual", default=0)
    padding = models.PositiveSmallIntegerField("Digitos", default=5)

    class Meta:
        verbose_name = "Consecutivo de documento"
        verbose_name_plural = "Consecutivos de documento"
        constraints = [
            models.UniqueConstraint(
                fields=["key", "period_key"], name="uniq_document_sequence_key_period"
            )
        ]

    def __str__(self) -> str:
        return f"{self.key} [{self.period_key or 'global'}] = {self.current_number}"

    @classmethod
    def next_value(
        cls,
        key: str,
        prefix: str,
        period_key: str = "",
        padding: int = 5,
    ) -> str:
        """Devuelve el siguiente folio formateado, p. ej. ``R-20260815-00042``."""
        with transaction.atomic():
            sequence = (
                cls.objects.select_for_update()
                .filter(key=key, period_key=period_key)
                .first()
            )
            if sequence is None:
                sequence, _ = cls.objects.get_or_create(
                    key=key,
                    period_key=period_key,
                    defaults={"prefix": prefix, "padding": padding},
                )
                sequence = (
                    cls.objects.select_for_update().get(pk=sequence.pk)
                )
            sequence.current_number += 1
            sequence.save(update_fields=["current_number"])

        number = str(sequence.current_number).zfill(sequence.padding)
        parts = [sequence.prefix, sequence.period_key, number]
        return "-".join(part for part in parts if part)
