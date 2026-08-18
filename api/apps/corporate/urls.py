from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.corporate.views import (
    AccessViewSet, AccessibleMotelsView, BulkConfigView, CorporateDashboardView,
    CorporateUserViewSet, GroupViewSet, RegionViewSet,
)

router = DefaultRouter()
router.register("groups", GroupViewSet, basename="corporate-group")
router.register("regions", RegionViewSet, basename="corporate-region")
router.register("users", CorporateUserViewSet, basename="corporate-user")
router.register("accesses", AccessViewSet, basename="corporate-access")

urlpatterns = [
    path("dashboard/", CorporateDashboardView.as_view(), name="corporate-dashboard"),
    path("motels/", AccessibleMotelsView.as_view(), name="corporate-motels"),
    path("bulk-config/", BulkConfigView.as_view(), name="corporate-bulk-config"),
    path("", include(router.urls)),
]
