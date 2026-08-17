"""Serializadores de la bitácora."""

from rest_framework import serializers

from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, default=None)
    target_model = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "created_at",
            "actor",
            "actor_name",
            "actor_username",
            "action",
            "action_display",
            "module",
            "module_display",
            "description",
            "target_model",
            "object_id",
            "object_repr",
            "changes",
            "extra",
            "ip_address",
            "user_agent",
        )
        read_only_fields = fields

    def get_target_model(self, log: AuditLog) -> str | None:
        if log.content_type_id is None:
            return None
        return f"{log.content_type.app_label}.{log.content_type.model}"


class AuditSummarySerializer(serializers.Serializer):
    """Conteo de operaciones por acción, para el tablero de gerencia."""

    action = serializers.CharField()
    action_display = serializers.CharField()
    total = serializers.IntegerField()
