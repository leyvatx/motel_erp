"""Rutas de inventario: ``/api/v1/inventory/``."""

from rest_framework.routers import DefaultRouter

from apps.inventory.views import (
    KardexViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
    PurchaseOrderViewSet,
    StockLotViewSet,
    WarehouseStockViewSet,
    WarehouseViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("categories", ProductCategoryViewSet, basename="product-category")
router.register("products", ProductViewSet, basename="product")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchases", PurchaseOrderViewSet, basename="purchase")
router.register("stocks", WarehouseStockViewSet, basename="stock")
router.register("lots", StockLotViewSet, basename="lot")
router.register("kardex", KardexViewSet, basename="kardex")

urlpatterns = router.urls
