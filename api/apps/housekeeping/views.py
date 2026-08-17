"""API de ama de llaves: tareas de limpieza y mantenimiento."""

from __future__ import annotations

from django.db.models import Avg, Count, Prefetch, Q, Sum
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.serializers import ReasonSerializer

from apps.housekeeping import services
from apps.housekeeping.constants import CleaningTaskStatus, MaintenanceStatus
from apps.housekeeping.models import CleaningTask, MaintenanceReport, MaintenanceUpdate
from apps.housekeeping.serializers import (
    AssignTaskSerializer,
    CleaningPerformanceSerializer,
    CleaningTaskInputSerializer,
    CleaningTaskSerializer,
    FinishTaskSerializer,
    MaintenanceInputSerializer,
    MaintenanceReportListSerializer,
    MaintenanceReportSerializer,
    MaintenanceTransitionSerializer,
)
from apps.rooms.models import Room
from apps.users.constants import PermissionCode
from apps.users.models import User


class CleaningTaskViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Tareas de limpieza.

    Las que nacen de un check-out se crean solas; por aquí se crean las
    manuales (limpieza profunda, inspeccion) y se opera su ciclo de vida.
    """

    queryset = CleaningTask.objects.select_related("room", "assigned_to", "stay", "verified_by")
    serializer_class = CleaningTaskSerializer
    required_permissions = {
        "*": [PermissionCode.HOUSEKEEPING_TASK],
        "performance": [PermissionCode.REPORT_VIEW],
    }
    filterset_fields = ["status", "room", "assigned_to", "task_type", "found_issues"]
    search_fields = ["room__number", "notes"]
    ordering_fields = ["priority", "created_at", "duration_seconds"]

    @extend_schema(request=CleaningTaskInputSerializer, responses=CleaningTaskSerializer)
    def create(self, request) -> Response:
        serializer = CleaningTaskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        task = services.create_cleaning_task(
            room=Room.objects.get(pk=payload["room_id"], is_active=True),
            task_type=payload["task_type"],
            priority=payload["priority"],
            notes=payload.get("notes", ""),
            actor=request.user,
        )
        return Response(CleaningTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=CleaningTaskSerializer(many=True))
    @action(detail=False, methods=["get"])
    def board(self, request) -> Response:
        """Tablero de trabajo: lo que está pendiente o en proceso, por prioridad."""
        queryset = self.get_queryset().filter(
            status__in=[
                CleaningTaskStatus.PENDING,
                CleaningTaskStatus.ASSIGNED,
                CleaningTaskStatus.IN_PROGRESS,
            ]
        )
        if request.query_params.get("mine") == "true":
            queryset = queryset.filter(assigned_to=request.user)
        queryset = queryset.order_by("priority", "created_at")

        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(CleaningTaskSerializer(page, many=True).data)

    @extend_schema(request=AssignTaskSerializer, responses=CleaningTaskSerializer)
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None) -> Response:
        serializer = AssignTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = User.objects.get(pk=serializer.validated_data["employee_id"], is_active=True)
        task = services.assign_cleaning_task(
            task_id=int(pk), employee=employee, actor=request.user
        )
        return Response(CleaningTaskSerializer(task).data)

    @extend_schema(request=None, responses=CleaningTaskSerializer)
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None) -> Response:
        task = services.start_cleaning_task(task_id=int(pk), actor=request.user)
        return Response(CleaningTaskSerializer(task).data)

    @extend_schema(request=FinishTaskSerializer, responses=CleaningTaskSerializer)
    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None) -> Response:
        """Cierra la limpieza y libera la habitación."""
        serializer = FinishTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = services.finish_cleaning_task(
            task_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(CleaningTaskSerializer(task).data)

    @extend_schema(request=None, responses=CleaningTaskSerializer)
    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None) -> Response:
        task = services.verify_cleaning_task(task_id=int(pk), actor=request.user)
        return Response(CleaningTaskSerializer(task).data)

    @extend_schema(request=ReasonSerializer, responses=CleaningTaskSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = services.cancel_cleaning_task(
            task_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        return Response(CleaningTaskSerializer(task).data)

    @extend_schema(responses=CleaningPerformanceSerializer(many=True))
    @action(detail=False, methods=["get"])
    def performance(self, request) -> Response:
        """Tiempos promedio de limpieza por empleado.

        Acepta ``?from=YYYY-MM-DD&to=YYYY-MM-DD``.
        """
        queryset = CleaningTask.objects.filter(
            status__in=[CleaningTaskStatus.DONE, CleaningTaskStatus.VERIFIED],
            duration_seconds__isnull=False,
        )
        desde = request.query_params.get("from")
        hasta = request.query_params.get("to")
        if desde:
            queryset = queryset.filter(finished_at__date__gte=desde)
        if hasta:
            queryset = queryset.filter(finished_at__date__lte=hasta)

        filas = (
            queryset.values("assigned_to", "assigned_to__full_name")
            .annotate(
                tasks=Count("id"),
                average_seconds=Avg("duration_seconds"),
                total_seconds=Sum("duration_seconds"),
                issues_reported=Count("id", filter=Q(found_issues=True)),
            )
            .order_by("-tasks")
        )

        data = [
            {
                "employee_id": fila["assigned_to"],
                "employee": fila["assigned_to__full_name"],
                "tasks": fila["tasks"],
                "average_seconds": int(fila["average_seconds"]) if fila["average_seconds"] else None,
                "total_seconds": fila["total_seconds"] or 0,
                "issues_reported": fila["issues_reported"],
            }
            for fila in filas
        ]
        return Response(CleaningPerformanceSerializer(data, many=True).data)


class MaintenanceReportViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = MaintenanceReport.objects.select_related(
        "room", "reported_by", "assigned_to", "resolved_by"
    )
    serializer_class = MaintenanceReportSerializer
    required_permissions = {"write": [PermissionCode.MAINTENANCE_REPORT]}
    filterset_fields = ["status", "priority", "category", "room", "blocks_room", "assigned_to"]
    search_fields = ["folio", "title", "description", "room__number"]
    ordering_fields = ["created_at", "priority", "resolved_at"]

    def get_serializer_class(self):
        return (
            MaintenanceReportListSerializer
            if self.action == "list"
            else MaintenanceReportSerializer
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in {"retrieve", "transition", "create"}:
            return queryset.prefetch_related(
                Prefetch(
                    "updates",
                    queryset=MaintenanceUpdate.objects.select_related("created_by").order_by(
                        "created_at"
                    ),
                )
            )
        return queryset

    @extend_schema(request=MaintenanceInputSerializer, responses=MaintenanceReportSerializer)
    def create(self, request) -> Response:
        serializer = MaintenanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = services.report_maintenance(actor=request.user, **serializer.validated_data)
        return Response(
            MaintenanceReportSerializer(self.get_queryset().get(pk=report.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=MaintenanceTransitionSerializer, responses=MaintenanceReportSerializer
    )
    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None) -> Response:
        """Avanza el reporte por su flujo dejando nota de seguimiento."""
        serializer = MaintenanceTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = dict(serializer.validated_data)

        assigned_to = None
        if payload.pop("assigned_to_id", None):
            assigned_to = User.objects.get(
                pk=serializer.validated_data["assigned_to_id"], is_active=True
            )

        services.update_maintenance_status(
            report_id=int(pk), actor=request.user, assigned_to=assigned_to, **payload
        )
        return Response(
            MaintenanceReportSerializer(self.get_queryset().get(pk=pk)).data
        )

    @extend_schema(responses=MaintenanceReportListSerializer(many=True))
    @action(detail=False, methods=["get"])
    def open(self, request) -> Response:
        queryset = self.get_queryset().filter(
            status__in=[
                MaintenanceStatus.REPORTED,
                MaintenanceStatus.ACKNOWLEDGED,
                MaintenanceStatus.IN_PROGRESS,
            ]
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(
            MaintenanceReportListSerializer(page, many=True).data
        )
