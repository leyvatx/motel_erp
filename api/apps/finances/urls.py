"""Rutas de finanzas: ``/api/v1/finances/``."""

from rest_framework.routers import DefaultRouter

from apps.finances.views import CashMovementViewSet, ExpenseViewSet, ShiftViewSet

router = DefaultRouter()
router.register("shifts", ShiftViewSet, basename="shift")
router.register("cash-movements", CashMovementViewSet, basename="cash-movement")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = router.urls
