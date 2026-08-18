"""Serializadores reutilizables entre modulos."""

from rest_framework import serializers

from apps.users.constants import PermissionCode, permissions_for
from common.middleware import get_current_user, has_current_request


class ReasonSerializer(serializers.Serializer):
    """Entrada estándar de toda operación que exige justificacion.

    Cancelar una renta, un consumo o un pago nunca es anonimo: el motivo
    viaja al AuditLog.
    """

    reason = serializers.CharField(max_length=255)


class EmptySerializer(serializers.Serializer):
    """Para acciones sin cuerpo de petición."""


class CostVisibilityMixin:
    """Quita del payload los campos de costo a quien no compra.

    Recepción y ama de llaves necesitan el catálogo y el Kardex para cargar
    consumos y reportar mermas, pero cuánto costó la mercancía es del dueño:
    de ahí sale el margen. El permiso que lo abre es el de compras.

    El usuario se toma del contexto de la petición y no del ``context`` del
    serializador porque varias acciones lo instancian a mano, sin pasarlo.
    Fuera de una petición no se recorta nada: ahí no hay respuesta que filtrar
    y quien lee es el generador del esquema o una tarea interna.
    """

    cost_fields: tuple[str, ...] = ()

    def get_fields(self):
        fields = super().get_fields()
        if not has_current_request():
            return fields
        if PermissionCode.INVENTORY_PURCHASE in permissions_for(get_current_user()):
            return fields
        for nombre in self.cost_fields:
            fields.pop(nombre, None)
        return fields
