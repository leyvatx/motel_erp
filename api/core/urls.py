"""Ruteo HTTP raiz.

Cada modulo expone su propio ``urls.py`` y se monta bajo ``/api/v1/``.
Los routers de cada app se van agregando conforme avanzan las fases.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

api_v1_patterns = [
    path("auth/", include("apps.users.urls")),
    path("settings/", include("apps.settings.urls")),
    path("frontdesk/", include("apps.rooms.urls")),
    path("sales/", include("apps.sales.urls")),
    path("", include("apps.notifications.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("housekeeping/", include("apps.housekeeping.urls")),
    path("finances/", include("apps.finances.urls")),
    path("audit/", include("apps.audit.urls")),
    path("reports/", include("apps.reports.urls")),
    path("corporate/", include("apps.corporate.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1_patterns, "api"), namespace="v1")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
