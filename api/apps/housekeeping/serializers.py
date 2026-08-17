"""Serializadores de ama de llaves."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.housekeeping.constants import (
    CleaningTaskType,
    MaintenanceCategory,
    MaintenancePriority,
    MaintenanceStatus,
)
from apps.housekeeping.models import CleaningTask, MaintenanceReport, MaintenanceUpdate


class CleaningTaskSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    task_type_display = serializers.CharField(source="get_task_type_display", read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.full_name", read_only=True, default=None
    )
    elapsed_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = CleaningTask
        fields = (
            "id",
            "room",
            "room_number",
            "stay",
            "task_type",
            "task_type_display",
            "status",
            "status_display",
            "priority",
            "assigned_to",
            "assigned_to_name",
            "assigned_at",
            "started_at",
            "finished_at",
            "duration_seconds",
            "elapsed_seconds",
            "verified_by",
            "verified_at",
            "notes",
            "found_issues",
            "cancellation_reason",
            "created_at",
        )
        read_only_fields = fields


class MaintenanceUpdateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = MaintenanceUpdate
        fields = (
            "id",
            "note",
            "status_before",
            "status_after",
            "created_by",
            "created_by_name",
            "created_at",
        )
        read_only_fields = fields


class MaintenanceReportSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.full_name", read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.full_name", read_only=True, default=None
    )
    updates = MaintenanceUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = MaintenanceReport
        fields = (
            "id",
            "folio",
            "room",
            "room_number",
            "area",
            "title",
            "description",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "blocks_room",
            "reported_by",
            "reported_by_name",
            "assigned_to",
            "assigned_to_name",
            "cleaning_task",
            "resolved_at",
            "resolved_by",
            "resolution_notes",
            "cost",
            "cancellation_reason",
            "created_at",
            "updates",
        )
        read_only_fields = fields


class MaintenanceReportListSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source="room.number", read_only=True, default=None)

    class Meta:
        model = MaintenanceReport
        fields = (
            "id",
            "folio",
            "room",
            "room_number",
            "title",
            "category",
            "priority",
            "status",
            "blocks_room",
            "created_at",
            "resolved_at",
        )
        read_only_fields = fields


# --- Entradas -------------------------------------------------------------
class CleaningTaskInputSerializer(serializers.Serializer):
    room_id = serializers.IntegerField()
    task_type = serializers.ChoiceField(
        choices=CleaningTaskType.choices, default=CleaningTaskType.DEEP
    )
    priority = serializers.IntegerField(default=100, min_value=1, max_value=999)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class AssignTaskSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()


class FinishTaskSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    found_issues = serializers.BooleanField(default=False)


class MaintenanceInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    description = serializers.CharField()
    room_id = serializers.IntegerField(required=False, allow_null=True)
    area = serializers.CharField(required=False, allow_blank=True, max_length=80)
    category = serializers.ChoiceField(
        choices=MaintenanceCategory.choices, default=MaintenanceCategory.OTHER
    )
    priority = serializers.ChoiceField(
        choices=MaintenancePriority.choices, default=MaintenancePriority.MEDIUM
    )
    blocks_room = serializers.BooleanField(default=False)
    cleaning_task_id = serializers.IntegerField(required=False, allow_null=True)


class MaintenanceTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=MaintenanceStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)
    resolution_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )


class CleaningPerformanceSerializer(serializers.Serializer):
    """Rendimiento por empleado: base del reporte gerencial."""

    employee_id = serializers.IntegerField(allow_null=True)
    employee = serializers.CharField(allow_null=True)
    tasks = serializers.IntegerField()
    average_seconds = serializers.IntegerField(allow_null=True)
    total_seconds = serializers.IntegerField()
    issues_reported = serializers.IntegerField()
