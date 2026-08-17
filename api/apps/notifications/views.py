"""API de la campana del topbar.

El WebSocket entrega los avisos en vivo; estos endpoints sirven para el
historial al cargar la aplicación y para marcarlos como leidos.
"""

from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.notifications import services
from apps.notifications.models import Notification, NotificationLevel
from apps.notifications.serializers import (
    MarkReadSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
)


class NotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()
    filterset_fields = ["category", "level"]
    ordering_fields = ["created_at", "level"]

    def get_queryset(self):
        """Solo lo dirigido al rol del usuario, a el, o a todos."""
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        queryset = Notification.objects.filter(is_active=True).filter(
            Q(target_role="") | Q(target_role=user.role) | Q(target_user=user)
        )
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset.select_related("target_user").order_by("-created_at")

    @extend_schema(responses=UnreadCountSerializer)
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request) -> Response:
        queryset = self.get_queryset().filter(read_at__isnull=True)
        data = {
            "unread": queryset.count(),
            "critical": queryset.filter(level=NotificationLevel.CRITICAL).count(),
        }
        return Response(UnreadCountSerializer(data).data)

    @extend_schema(request=MarkReadSerializer, responses=UnreadCountSerializer)
    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read(self, request) -> Response:
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.mark_read(notification_ids=serializer.validated_data["ids"], user=request.user)
        return self.unread_count(request)

    @extend_schema(request=None, responses=UnreadCountSerializer)
    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request) -> Response:
        ids = list(self.get_queryset().filter(read_at__isnull=True).values_list("id", flat=True))
        if ids:
            services.mark_read(notification_ids=ids, user=request.user)
        return self.unread_count(request)
