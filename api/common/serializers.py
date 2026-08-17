"""Serializadores reutilizables entre modulos."""

from rest_framework import serializers


class ReasonSerializer(serializers.Serializer):
    """Entrada estándar de toda operación que exige justificacion.

    Cancelar una renta, un consumo o un pago nunca es anonimo: el motivo
    viaja al AuditLog.
    """

    reason = serializers.CharField(max_length=255)


class EmptySerializer(serializers.Serializer):
    """Para acciones sin cuerpo de petición."""
