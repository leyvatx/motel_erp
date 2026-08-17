"""Rutas de ama de llaves: ``/api/v1/housekeeping/``."""

from rest_framework.routers import DefaultRouter

from apps.housekeeping.views import CleaningTaskViewSet, MaintenanceReportViewSet

router = DefaultRouter()
router.register("cleaning-tasks", CleaningTaskViewSet, basename="cleaning-task")
router.register("maintenance", MaintenanceReportViewSet, basename="maintenance")

urlpatterns = router.urls
