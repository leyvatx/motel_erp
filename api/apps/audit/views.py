"""Consulta de la bitácora. Solo lectura: nadie edita la auditoría."""

from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.constants import AuditAction
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer, AuditSummarySerializer
from apps.users.constants import PermissionCode


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related("actor", "content_type")
    serializer_class = AuditLogSerializer
    required_permissions = {"*": [PermissionCode.AUDIT_VIEW]}
    filterset_fields = ["action", "module", "actor"]
    search_fields = ["description", "object_repr", "actor_username"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        desde, hasta = params.get("from"), params.get("to")
        if desde:
            queryset = queryset.filter(created_at__date__gte=desde)
        if hasta:
            queryset = queryset.filter(created_at__date__lte=hasta)

        target = params.get("target")
        object_id = params.get("object_id")
        if target and "." in target:
            app_label, model = target.split(".", 1)
            content_type = ContentType.objects.filter(
                app_label=app_label, model=model.lower()
            ).first()
            queryset = queryset.filter(content_type=content_type)
            if object_id:
                queryset = queryset.filter(object_id=object_id)
        return queryset

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str, description="Fecha inicial (YYYY-MM-DD)."),
            OpenApiParameter("to", str, description="Fecha final (YYYY-MM-DD)."),
            OpenApiParameter("target", str, description='Modelo, p. ej. "rooms.stay".'),
            OpenApiParameter("object_id", int, description="Id del objeto rastreado."),
        ],
        responses=AuditLogSerializer(many=True),
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(responses=AuditSummarySerializer(many=True))
    @action(detail=False, methods=["get"])
    def summary(self, request) -> Response:
        """Conteo por tipo de acción en el periodo consultado."""
        etiquetas = dict(AuditAction.choices)
        filas = (
            self.get_queryset()
            .values("action")
            .annotate(total=Count("id"))
            .order_by("-total")
        )
        data = [
            {
                "action": fila["action"],
                "action_display": etiquetas.get(fila["action"], fila["action"]),
                "total": fila["total"],
            }
            for fila in filas
        ]
        return Response(AuditSummarySerializer(data, many=True).data)
