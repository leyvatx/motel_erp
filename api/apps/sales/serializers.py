"""Serializadores del modulo de ventas."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from common.serializers import ReasonSerializer

from apps.sales.constants import OrderType, PaymentMethod
from apps.sales.models import Folio, FolioCharge, Order, OrderItem, Payment


class OrderItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_sku",
            "description",
            "quantity",
            "unit_price",
            "discount_amount",
            "tax_rate",
            "tax_amount",
            "line_total",
            "is_active",
            "cancelled_at",
            "cancellation_reason",
        )
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    order_type_display = serializers.CharField(source="get_order_type_display", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "code",
            "folio",
            "order_type",
            "order_type_display",
            "status",
            "status_display",
            "warehouse",
            "warehouse_name",
            "placed_at",
            "delivered_at",
            "delivered_by",
            "subtotal",
            "tax_total",
            "total",
            "notes",
            "cancelled_at",
            "cancellation_reason",
            "items",
        )
        read_only_fields = fields


class FolioChargeSerializer(serializers.ModelSerializer):
    charge_type_display = serializers.CharField(source="get_charge_type_display", read_only=True)

    class Meta:
        model = FolioCharge
        fields = (
            "id",
            "charge_type",
            "charge_type_display",
            "description",
            "quantity",
            "unit_price",
            "tax_amount",
            "amount",
            "order",
            "stay_extension",
            "is_active",
            "cancelled_at",
            "cancellation_reason",
            "created_at",
        )
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    received_by_name = serializers.CharField(source="received_by.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "folio",
            "method",
            "method_display",
            "status",
            "amount",
            "tendered_amount",
            "change_amount",
            "reference",
            "received_by",
            "received_by_name",
            "paid_at",
            "voided_at",
            "void_reason",
        )
        read_only_fields = fields


class FolioSerializer(serializers.ModelSerializer):
    """Cuenta abierta con todo lo consumido. Es lo que ve la pantalla de cobro."""

    charges = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    orders = OrderSerializer(many=True, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    room_number = serializers.CharField(source="room.number", read_only=True, default=None)
    stay_code = serializers.CharField(source="stay.code", read_only=True, default=None)

    class Meta:
        model = Folio
        fields = (
            "id",
            "code",
            "folio_type",
            "status",
            "status_display",
            "stay",
            "stay_code",
            "room",
            "room_number",
            "opened_at",
            "closed_at",
            "subtotal",
            "discount_total",
            "tax_total",
            "total",
            "paid_total",
            "balance",
            "notes",
            "charges",
            "payments",
            "orders",
        )
        read_only_fields = fields

    def get_charges(self, folio: Folio) -> list[dict]:
        charges = [charge for charge in folio.charges.all() if charge.is_active]
        return FolioChargeSerializer(charges, many=True).data

    def get_payments(self, folio: Folio) -> list[dict]:
        payments = [payment for payment in folio.payments.all() if payment.is_active]
        return PaymentSerializer(payments, many=True).data


class FolioListSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    room_number = serializers.CharField(source="room.number", read_only=True, default=None)

    class Meta:
        model = Folio
        fields = (
            "id",
            "code",
            "folio_type",
            "status",
            "room",
            "room_number",
            "opened_at",
            "closed_at",
            "total",
            "paid_total",
            "balance",
        )
        read_only_fields = fields


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )
    discount_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )


class CreateOrderSerializer(serializers.Serializer):
    """Alta de consumo contra la cuenta abierta."""

    folio_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(
        choices=OrderType.choices, default=OrderType.ROOM_SERVICE
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    items = OrderItemInputSerializer(many=True, allow_empty=False)


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    tendered_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, min_value=Decimal("0")
    )
    reference = serializers.CharField(required=False, allow_blank=True, max_length=60)


class DiscountInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(max_length=180)
