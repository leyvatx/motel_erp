"""Serializadores de finanzas y caja."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.finances.constants import (
    CASH_DENOMINATIONS,
    CashDirection,
    CashMovementReason,
    ExpenseCategory,
    ShiftType,
)
from apps.finances.models import CashCount, CashMovement, Expense, Shift


class BreakdownField(serializers.DictField):
    """Desglose de denominaciones: ``{"500": 3, "100": 12}``."""

    child = serializers.IntegerField(min_value=0)

    def validate_empty_values(self, data):
        return super().validate_empty_values(data)


class ShiftSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source="cashier.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    shift_type_display = serializers.CharField(source="get_shift_type_display", read_only=True)
    total_sales = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Shift
        fields = (
            "id",
            "code",
            "cashier",
            "cashier_name",
            "shift_type",
            "shift_type_display",
            "status",
            "status_display",
            "opened_at",
            "closed_at",
            "business_date",
            "opening_balance",
            "cash_sales",
            "card_sales",
            "transfer_sales",
            "courtesy_total",
            "cash_in_total",
            "cash_out_total",
            "expenses_total",
            "expected_cash",
            "declared_cash",
            "difference",
            "total_sales",
            "folios_closed",
            "stays_closed",
            "closed_by",
            "verified_by",
            "verified_at",
            "notes",
        )
        read_only_fields = fields


class ShiftListSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source="cashier.full_name", read_only=True)

    class Meta:
        model = Shift
        fields = (
            "id",
            "code",
            "cashier",
            "cashier_name",
            "status",
            "opened_at",
            "closed_at",
            "business_date",
            "expected_cash",
            "declared_cash",
            "difference",
        )
        read_only_fields = fields


class CashCountSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    counted_by_name = serializers.CharField(source="counted_by.full_name", read_only=True)

    class Meta:
        model = CashCount
        fields = (
            "id",
            "shift",
            "kind",
            "kind_display",
            "breakdown",
            "declared_total",
            "counted_by",
            "counted_by_name",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class CashMovementSerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source="get_direction_display", read_only=True)
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)

    class Meta:
        model = CashMovement
        fields = (
            "id",
            "shift",
            "direction",
            "direction_display",
            "reason",
            "reason_display",
            "amount",
            "description",
            "reference",
            "expense",
            "performed_by",
            "performed_by_name",
            "created_at",
        )
        read_only_fields = fields


class ExpenseSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True)
    reviewed_by_name = serializers.CharField(
        source="reviewed_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = Expense
        fields = (
            "id",
            "folio",
            "shift",
            "category",
            "category_display",
            "description",
            "supplier",
            "amount",
            "status",
            "status_display",
            "requires_approval",
            "receipt_reference",
            "requested_by",
            "requested_by_name",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_notes",
            "created_at",
        )
        read_only_fields = fields


# --- Entradas -------------------------------------------------------------
class OpenShiftSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), default=Decimal("0")
    )
    shift_type = serializers.ChoiceField(choices=ShiftType.choices, default=ShiftType.MORNING)
    breakdown = BreakdownField(required=False)
    cashier_id = serializers.IntegerField(
        required=False, help_text="Solo gerencia puede abrir turno a nombre de otro."
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CloseShiftSerializer(serializers.Serializer):
    """Corte ciego: el cajero declara sin ver lo que el sistema espera."""

    declared_cash = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0")
    )
    breakdown = BreakdownField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class VerifyShiftSerializer(serializers.Serializer):
    counted_cash = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0")
    )
    breakdown = BreakdownField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CashMovementInputSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=CashDirection.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.ChoiceField(
        choices=CashMovementReason.choices, default=CashMovementReason.OTHER
    )
    description = serializers.CharField(required=False, allow_blank=True, max_length=255)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class ExpenseInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(max_length=255)
    category = serializers.ChoiceField(
        choices=ExpenseCategory.choices, default=ExpenseCategory.OTHER
    )
    supplier = serializers.CharField(required=False, allow_blank=True, max_length=120)
    receipt_reference = serializers.CharField(required=False, allow_blank=True, max_length=60)
    shift_id = serializers.IntegerField(required=False, allow_null=True)


class ExpenseReviewSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)


class ShiftSummarySerializer(serializers.Serializer):
    """Vista previa del corte, sin cerrar el turno.

    Solo gerencia la consulta: mostrarsela al cajero rompe el corte ciego.
    """

    cash_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    card_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    transfer_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    courtesy_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    cash_in_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    cash_out_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    expenses_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    expected_cash = serializers.DecimalField(max_digits=12, decimal_places=2)
    folios_closed = serializers.IntegerField()
    stays_closed = serializers.IntegerField()


class DenominationSerializer(serializers.Serializer):
    denominations = serializers.ListField(child=serializers.DecimalField(max_digits=8, decimal_places=2))

    @staticmethod
    def current() -> dict:
        return {"denominations": list(CASH_DENOMINATIONS)}
