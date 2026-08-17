"""Managers y querysets base para el borrado lógico (soft delete)."""

from __future__ import annotations

from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet que prohíbe el borrado físico accidental."""

    def alive(self) -> "SoftDeleteQuerySet":
        return self.filter(is_active=True)

    def dead(self) -> "SoftDeleteQuerySet":
        return self.filter(is_active=False)

    def delete(self):  # noqa: A003 - se sobreescribe intencionalmente
        """Redirige cualquier ``.delete()`` masivo a un borrado lógico."""
        return self.soft_delete()

    def soft_delete(self, user=None, reason: str = "") -> int:
        return self.update(
            is_active=False,
            deleted_at=timezone.now(),
            deleted_by=user,
            deletion_reason=reason,
        )

    def restore(self) -> int:
        return self.update(
            is_active=True,
            deleted_at=None,
            deleted_by=None,
            deletion_reason="",
        )

    def hard_delete(self):
        """Borrado físico real. Solo para mantenimiento / tests."""
        return super().delete()


class ActiveManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """Manager por defecto: expone únicamente los registros vigentes."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().filter(is_active=True)


class AllObjectsManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """Manager sin filtros: necesario para auditoría y reportes históricos."""
