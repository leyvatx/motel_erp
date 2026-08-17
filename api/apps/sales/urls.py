"""Rutas de ventas: ``/api/v1/sales/``."""

from rest_framework.routers import DefaultRouter

from apps.sales.views import FolioViewSet, OrderViewSet, PaymentViewSet

router = DefaultRouter()
router.register("folios", FolioViewSet, basename="folio")
router.register("orders", OrderViewSet, basename="order")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = router.urls
