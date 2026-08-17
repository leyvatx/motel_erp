"""API de inventarios: catalogos, existencias, lotes y Kardex."""

from __future__ import annotations

from django.db.models import F, Sum
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.pagination import LargePagination

from apps.inventory import services
from apps.users.constants import PermissionCode

CATALOG_PERMISSIONS = {
    "read": [PermissionCode.INVENTORY_VIEW],
    "write": [PermissionCode.CONFIG_MANAGE],
}
from apps.inventory.constants import MovementType
from apps.inventory.models import (
    Product,
    ProductCategory,
    StockLot,
    StockMovement,
    Warehouse,
    WarehouseStock,
)
from apps.inventory.serializers import (
    ProductCategorySerializer,
    ProductSerializer,
    StockAdjustmentSerializer,
    StockConsumptionSerializer,
    StockEntrySerializer,
    StockLevelSerializer,
    StockLotSerializer,
    StockMovementSerializer,
    StockTransferSerializer,
    StockWasteSerializer,
    WarehouseSerializer,
    WarehouseStockSerializer,
)


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.select_related("responsible")
    serializer_class = WarehouseSerializer
    required_permissions = CATALOG_PERMISSIONS
    pagination_class = LargePagination
    filterset_fields = ["warehouse_type", "is_active"]
    search_fields = ["code", "name"]

    def perform_destroy(self, instance: Warehouse) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de almacén")


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    required_permissions = CATALOG_PERMISSIONS
    pagination_class = LargePagination
    filterset_fields = ["kind", "is_active"]
    search_fields = ["name"]

    def perform_destroy(self, instance: ProductCategory) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de categoría")


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category").annotate(
        total_stock=Sum("stocks__quantity")
    )
    serializer_class = ProductSerializer
    required_permissions = CATALOG_PERMISSIONS
    filterset_fields = ["category", "is_sellable", "is_stockable", "track_expiration", "is_active"]
    search_fields = ["sku", "name", "barcode"]
    ordering_fields = ["name", "sku", "sale_price"]

    def perform_destroy(self, instance: Product) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de producto")

    @extend_schema(responses=ProductSerializer(many=True))
    @action(detail=False, methods=["get"])
    def sellable(self, request) -> Response:
        """Catalogo para el POS y el room service."""
        queryset = self.filter_queryset(
            self.get_queryset().filter(is_active=True, is_sellable=True)
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(ProductSerializer(page, many=True).data)


class WarehouseStockViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Existencias por almacén. Las cantidades solo se mueven por el Kardex."""

    queryset = WarehouseStock.objects.select_related("product", "warehouse")
    serializer_class = WarehouseStockSerializer
    required_permissions = {
        "read": [PermissionCode.INVENTORY_VIEW],
        "set_levels": [PermissionCode.CONFIG_MANAGE],
    }
    filterset_fields = ["warehouse", "product", "product__category"]
    search_fields = ["product__sku", "product__name"]
    ordering_fields = ["quantity", "product__name"]

    @extend_schema(responses=WarehouseStockSerializer(many=True))
    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request) -> Response:
        """Productos en o por debajo de su mínimo."""
        queryset = self.filter_queryset(
            self.get_queryset().filter(min_stock__gt=0, quantity__lte=F("min_stock"))
        ).order_by("quantity")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(WarehouseStockSerializer(page, many=True).data)

    @extend_schema(request=StockLevelSerializer, responses=WarehouseStockSerializer)
    @action(detail=True, methods=["post"], url_path="levels")
    def set_levels(self, request, pk=None) -> Response:
        """Define mínimos y máximos que disparan las alertas."""
        serializer = StockLevelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        stock = self.get_object()
        stock.min_stock = serializer.validated_data["min_stock"]
        if "max_stock" in serializer.validated_data:
            stock.max_stock = serializer.validated_data["max_stock"]
        stock.low_stock_notified_at = None
        stock.save(update_fields=["min_stock", "max_stock", "low_stock_notified_at", "updated_at"])
        return Response(WarehouseStockSerializer(stock).data)


class StockLotViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = StockLot.objects.select_related("product", "warehouse")
    serializer_class = StockLotSerializer
    required_permissions = {"read": [PermissionCode.INVENTORY_VIEW]}
    filterset_fields = ["warehouse", "product", "is_active"]
    ordering_fields = ["expiration_date", "received_at"]

    @extend_schema(responses=StockLotSerializer(many=True))
    @action(detail=False, methods=["get"])
    def expiring(self, request) -> Response:
        """Lotes por caducar dentro de N días (``?days=7``)."""
        from datetime import timedelta

        from django.utils import timezone

        days = int(request.query_params.get("days", 7))
        limit = timezone.localdate() + timedelta(days=days)
        queryset = (
            self.get_queryset()
            .filter(is_active=True, quantity__gt=0, expiration_date__lte=limit)
            .order_by("expiration_date")
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(StockLotSerializer(page, many=True).data)


class KardexViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Kardex inmutable y operaciones que lo alimentan.

    No hay PUT ni DELETE: un movimiento equivocado se corrige con otro en
    sentido contrario, nunca borrando el original.
    """

    queryset = StockMovement.objects.select_related(
        "product", "warehouse", "lot", "performed_by"
    )
    serializer_class = StockMovementSerializer
    required_permissions = {
        "read": [PermissionCode.INVENTORY_VIEW],
        "entry": [PermissionCode.INVENTORY_MOVE],
        "consumption": [PermissionCode.INVENTORY_MOVE],
        "transfer": [PermissionCode.INVENTORY_MOVE],
        "waste": [PermissionCode.INVENTORY_WASTE],
        "adjust": [PermissionCode.INVENTORY_MOVE, PermissionCode.CONFIG_MANAGE],
    }
    filterset_fields = ["product", "warehouse", "movement_type", "lot"]
    search_fields = ["product__sku", "product__name", "reason"]
    ordering_fields = ["created_at", "quantity"]

    def _get(self, model, pk: int, **filters):
        return model.objects.get(pk=pk, **filters)

    @extend_schema(request=StockEntrySerializer, responses=StockMovementSerializer)
    @action(detail=False, methods=["post"])
    def entry(self, request) -> Response:
        data = StockEntrySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data

        movement = services.register_entry(
            product=self._get(Product, payload["product_id"], is_active=True),
            warehouse=self._get(Warehouse, payload["warehouse_id"], is_active=True),
            quantity=payload["quantity"],
            unit_cost=payload.get("unit_cost"),
            movement_type=payload["movement_type"],
            lot_code=payload.get("lot_code", ""),
            expiration_date=payload.get("expiration_date"),
            reason=payload.get("reason", ""),
            actor=request.user,
        )
        return Response(
            StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=StockWasteSerializer, responses=StockMovementSerializer(many=True))
    @action(detail=False, methods=["post"])
    def waste(self, request) -> Response:
        data = StockWasteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data

        lot = None
        if payload.get("lot_id"):
            lot = self._get(StockLot, payload["lot_id"], is_active=True)

        movements = services.register_waste(
            product=self._get(Product, payload["product_id"], is_active=True),
            warehouse=self._get(Warehouse, payload["warehouse_id"], is_active=True),
            quantity=payload["quantity"],
            expired=payload["expired"],
            reason=payload["reason"],
            lot=lot,
            actor=request.user,
        )
        return Response(
            StockMovementSerializer(movements, many=True).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        request=StockConsumptionSerializer, responses=StockMovementSerializer(many=True)
    )
    @action(detail=False, methods=["post"])
    def consumption(self, request) -> Response:
        """Salida por consumo interno: amenidades, blancos, limpieza."""
        data = StockConsumptionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data

        movements = services.register_exit(
            product=self._get(Product, payload["product_id"], is_active=True),
            warehouse=self._get(Warehouse, payload["warehouse_id"], is_active=True),
            quantity=payload["quantity"],
            movement_type=MovementType.CONSUMPTION,
            reason=payload["reason"],
            actor=request.user,
        )
        return Response(
            StockMovementSerializer(movements, many=True).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=StockTransferSerializer, responses=StockMovementSerializer(many=True))
    @action(detail=False, methods=["post"])
    def transfer(self, request) -> Response:
        data = StockTransferSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data

        salidas, entrada = services.transfer_stock(
            product=self._get(Product, payload["product_id"], is_active=True),
            source_warehouse=self._get(Warehouse, payload["source_warehouse_id"], is_active=True),
            target_warehouse=self._get(Warehouse, payload["target_warehouse_id"], is_active=True),
            quantity=payload["quantity"],
            reason=payload.get("reason", ""),
            actor=request.user,
        )
        return Response(
            StockMovementSerializer([*salidas, entrada], many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=StockAdjustmentSerializer, responses=StockMovementSerializer)
    @action(detail=False, methods=["post"])
    def adjust(self, request) -> Response:
        """Ajuste por conteo físico. Reservado a gerencia."""
        data = StockAdjustmentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data

        movement = services.adjust_stock(
            product=self._get(Product, payload["product_id"], is_active=True),
            warehouse=self._get(Warehouse, payload["warehouse_id"], is_active=True),
            counted_quantity=payload["counted_quantity"],
            reason=payload["reason"],
            actor=request.user,
        )
        if movement is None:
            return Response({"detail": "El conteo coincide con el sistema."})
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
