"""Serializadores de inventario."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.inventory.constants import MovementType
from apps.inventory.models import (
    Product,
    ProductCategory,
    StockLot,
    StockMovement,
    Warehouse,
    WarehouseStock,
)


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
