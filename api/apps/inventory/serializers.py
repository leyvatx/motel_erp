"""Serializadores de inventario."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers
from django.db import transaction

from apps.inventory.constants import MovementType, PurchaseStatus
from apps.inventory.models import (
    Product,
    ProductCategory,
    PurchaseOrder,
    PurchaseOrderItem,
    StockLot,
    StockMovement,
    Warehouse,
    WarehouseStock,
    Supplier,
)
from common.models import DocumentSequence


class WarehouseSerializer(serializers.ModelSerializer):
    warehouse_type_display = serializers.CharField(
        source="get_warehouse_type_display", read_only=True
    )

    class Meta:
        model = Warehouse
        fields = (
            "id",
            "code",
            "name",
            "warehouse_type",
            "warehouse_type_display",
            "location",
            "is_default_for_sales",
            "responsible",
            "is_active",
        )


class ProductCategorySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = ProductCategory
        fields = ("id", "name", "kind", "kind_display", "description", "sort_order", "is_active")


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "sku",
            "barcode",
            "name",
            "category",
            "category_name",
            "unit",
            "unit_display",
            "is_sellable",
            "is_stockable",
            "track_expiration",
            "sale_price",
            "last_cost",
            "average_cost",
            "tax_rate",
            "default_min_stock",
            "total_stock",
            "is_active",
        )
        read_only_fields = ("last_cost", "average_cost")

    def get_total_stock(self, product: Product) -> Decimal | None:
        """Existencia total anotada en la vista (``total_stock``)."""
        return getattr(product, "total_stock", None)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = (
            "id", "code", "business_name", "tax_id", "contact_name", "phone", "email",
            "address", "payment_terms_days", "notes", "is_active", "created_at",
        )
        read_only_fields = ("id", "created_at")


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    pending_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    line_subtotal = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = (
            "id", "product", "product_name", "product_sku", "quantity", "received_quantity",
            "pending_quantity", "unit_cost", "tax_rate", "line_subtotal", "line_total",
        )
        read_only_fields = ("id", "received_quantity")


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.business_name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default=None)

    class Meta:
        model = PurchaseOrder
        fields = (
            "id", "folio", "supplier", "supplier_name", "warehouse", "warehouse_name",
            "status", "status_display", "order_date", "expected_date", "supplier_reference",
            "notes", "subtotal", "tax_total", "total", "received_at", "created_by_name",
            "created_at", "updated_at", "items",
        )
        read_only_fields = (
            "id", "folio", "status", "subtotal", "tax_total", "total", "received_at",
            "created_at", "updated_at",
        )

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Agrega al menos un producto.")
        products = [item["product"].pk for item in items]
        if len(products) != len(set(products)):
            raise serializers.ValidationError("No repitas productos en la misma compra.")
        return items

    @staticmethod
    def _totals(items):
        subtotal = sum((item["quantity"] * item["unit_cost"] for item in items), Decimal("0"))
        tax = sum(
            (item["quantity"] * item["unit_cost"] * item.get("tax_rate", Decimal("0")) for item in items),
            Decimal("0"),
        )
        return subtotal, tax, subtotal + tax

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        request = self.context["request"]
        subtotal, tax, total = self._totals(items)
        validated_data.update(
            folio=DocumentSequence.next_value("purchase", "OC"),
            subtotal=subtotal,
            tax_total=tax,
            total=total,
            created_by=request.user,
            updated_by=request.user,
        )
        order = PurchaseOrder.objects.create(**validated_data)
        PurchaseOrderItem.objects.bulk_create(
            [PurchaseOrderItem(order=order, **item) for item in items]
        )
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = PurchaseOrder.objects.select_for_update().get(pk=instance.pk)
        if instance.status != PurchaseStatus.DRAFT:
            raise serializers.ValidationError("Solo se puede editar una compra en borrador.")
        items = validated_data.pop("items", None)
        if items is not None:
            instance.items.all().delete()
            PurchaseOrderItem.objects.bulk_create(
                [PurchaseOrderItem(order=instance, **item) for item in items]
            )
            instance.subtotal, instance.tax_total, instance.total = self._totals(items)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_by = self.context["request"].user
        instance.save()
        return instance


class PurchaseReceiptItemSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    lot_code = serializers.CharField(required=False, allow_blank=True, max_length=40)
    expiration_date = serializers.DateField(required=False, allow_null=True)


class PurchaseReceiptSerializer(serializers.Serializer):
    items = PurchaseReceiptItemSerializer(many=True, allow_empty=False)


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )
    is_below_minimum = serializers.BooleanField(read_only=True)

    class Meta:
        model = WarehouseStock
        fields = (
            "id",
            "product",
            "product_sku",
            "product_name",
            "warehouse",
            "warehouse_name",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "min_stock",
            "max_stock",
            "is_below_minimum",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "product",
            "warehouse",
            "quantity",
            "reserved_quantity",
            "updated_at",
        )


class StockLotSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockLot
        fields = (
            "id",
            "product",
            "product_name",
            "warehouse",
            "warehouse_name",
            "lot_code",
            "expiration_date",
            "quantity",
            "unit_cost",
            "received_at",
            "is_expired",
            "is_active",
        )
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    """Renglón del Kardex. Es de solo lectura por definicion: es inmutable."""

    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    movement_type_display = serializers.CharField(
        source="get_movement_type_display", read_only=True
    )
    performed_by_name = serializers.CharField(
        source="performed_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_sku",
            "product_name",
            "warehouse",
            "warehouse_name",
            "lot",
            "movement_type",
            "movement_type_display",
            "quantity",
            "signed_quantity",
            "balance_after",
            "unit_cost",
            "total_cost",
            "reason",
            "performed_by",
            "performed_by_name",
            "reversal_of",
            "created_at",
        )
        read_only_fields = fields


class StockEntrySerializer(serializers.Serializer):
    """Entrada de mercancia (compra, devolución, inventario inicial)."""

    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    unit_cost = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, min_value=Decimal("0")
    )
    movement_type = serializers.ChoiceField(
        choices=[
            (MovementType.PURCHASE, MovementType.PURCHASE.label),
            (MovementType.RETURN_IN, MovementType.RETURN_IN.label),
            (MovementType.INITIAL, MovementType.INITIAL.label),
        ],
        default=MovementType.PURCHASE,
    )
    lot_code = serializers.CharField(required=False, allow_blank=True, max_length=40)
    expiration_date = serializers.DateField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class StockWasteSerializer(serializers.Serializer):
    """Merma o baja por caducidad. El motivo es obligatorio."""

    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    lot_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    expired = serializers.BooleanField(default=False)
    reason = serializers.CharField(max_length=255)


class StockConsumptionSerializer(serializers.Serializer):
    """Consumo interno (amenidades, limpieza, blancos a las habitaciones)."""

    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    reason = serializers.CharField(max_length=255)


class StockTransferSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    source_warehouse_id = serializers.IntegerField()
    target_warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class StockAdjustmentSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    counted_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0")
    )
    reason = serializers.CharField(max_length=255)


class StockLevelSerializer(serializers.Serializer):
    """Ajuste de mínimos y máximos por almacén."""

    min_stock = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0"))
    max_stock = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0"), required=False
    )
