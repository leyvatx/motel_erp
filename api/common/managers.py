"""Managers y querysets base: borrado lógico y acotado por motel."""

from __future__ import annotations

from django.db import models
from django.utils import timezone

from common.tenancy import current_motel_id


class TenantQuerySet(models.QuerySet):
    """QuerySet que se limita al motel en curso.

    El filtro se aplica al construir la consulta, no al definirla, porque el
    motel depende de quien pregunta y eso solo se sabe en tiempo de petición.
    """

    def for_current_motel(self) -> "TenantQuerySet":
        motel_id = current_motel_id()
        if motel_id is None:
            return self
        return self.filter(motel_id=motel_id)

    def for_motel(self, motel) -> "TenantQuerySet":
        return self.filter(motel_id=getattr(motel, "pk", motel))


class SoftDeleteQuerySet(TenantQuerySet):
    """QuerySet que prohíbe el borrado físico accidental."""

    def alive(self) -> "SoftDeleteQuerySet":
        return self.filter(is_active=True)

    def dead(self) -> "SoftDeleteQuerySet":
        return self.filter(is_active=False)

    def delete(self):
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


class ScopedQuerySet(SoftDeleteQuerySet):
    """QuerySet que se vuelve a acotar cada vez que se reutiliza.

    Las vistas de DRF declaran su consulta como atributo de clase, así que se
    construye una sola vez al importar el módulo -- cuando todavia no hay
    petición ni motel -- y luego la reutilizan llamando a ``all()``. Volver a
    aplicar el filtro ahí es lo que evita que una pantalla termine mostrando
    las habitaciones de otro motel.
    """

    def all(self) -> "ScopedQuerySet":
        return super().all().for_current_motel()


class ScopedTenantQuerySet(TenantQuerySet):
    """Igual que ``ScopedQuerySet`` para los registros inmutables."""

    def all(self) -> "ScopedTenantQuerySet":
        return super().all().for_current_motel()


class TenantManager(models.Manager.from_queryset(ScopedTenantQuerySet)):
    """Manager por defecto de los registros que pertenecen a un motel."""

    def get_queryset(self) -> ScopedTenantQuerySet:
        return super().get_queryset().for_current_motel()


class ActiveManager(models.Manager.from_queryset(ScopedQuerySet)):
    """Manager por defecto: registros vigentes del motel en curso."""

    def get_queryset(self) -> ScopedQuerySet:
        return super().get_queryset().for_current_motel().filter(is_active=True)


class AllObjectsManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """Manager sin filtros, ni de baja lógica ni de motel.

    Es el ``base_manager_name`` de los modelos de negocio: Django lo usa para
    resolver relaciones, y si aquí se filtrara por motel una llave foránea
    apuntando a otro motel reventaria en vez de fallar de forma visible.
    Reservado para auditoría, reportes históricos y mantenimiento.
    """
