"""Serializadores de la campana de notificaciones."""

from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "category",
            "category_display",
            "level",
            "level_display",
            "title",
            "body",
            "payload",
            "target_role",
            "target_user",
            "read_at",
            "is_read",
            "created_at",
        )
        read_only_fields = fields

    def get_is_read(self, notification: Notification) -> bool:
        return notification.read_at is not None


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField()
    critical = serializers.IntegerField()
