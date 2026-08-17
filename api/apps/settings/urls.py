"""Rutas de configuración: ``/api/v1/settings/``."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.settings.views import (
    BusinessProfileView,
    MotelViewSet,
    PublicMotelView,
    TimeZoneListView,
)

router = DefaultRouter()
router.register("motels", MotelViewSet, basename="motel")

urlpatterns = [
    path("business/", BusinessProfileView.as_view(), name="business-profile"),
    path("business/public/", PublicMotelView.as_view(), name="business-profile-public"),
    path("time-zones/", TimeZoneListView.as_view(), name="time-zones"),
    path("", include(router.urls)),
]
