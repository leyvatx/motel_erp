"""Ruteo HTTP raiz.

Cada modulo expone su propio ``urls.py`` y se monta bajo ``/api/v1/``.
Los routers de cada app se van agregando conforme avanzan las fases.
"""

import re

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from common.health import awake, health

api_v1_patterns = [
    path("health/", health, name="health"),
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
    # Fuera de /api/v1/: son una sonda de infraestructura, no parte del
    # contrato de la API. No se versionan porque nada de lo que responden puede
    # cambiar. Son la misma vista con dos ligas: `/healthz` es el nombre que
    # buscan los monitores externos y `/api/health` la que ya estaba publicada.
    path("healthz", awake, name="healthz"),
    path("api/health", awake, name="awake"),
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

# Los archivos que sube el usuario -- logotipos, fotos de producto, evidencia de
# mantenimiento -- se sirven siempre, no solo en desarrollo.
#
# `static()` no hace nada cuando DEBUG es False, así que en producción la API
# guardaba la imagen, devolvía su URL, y esa URL contestaba 404: el usuario
# subía una foto, la veía en la vista previa, y al recargar encontraba un hueco.
# El fallo no estaba en la subida sino en que nadie servía lo subido.
#
# Sirve Django y no un proxy porque aquí no hay uno: en Render el contenedor
# atiende directo. Para el volumen de este producto -- una foto por producto,
# unas decenas por sucursal -- es de sobra. El día que haya almacenamiento
# externo (S3, Cloudinary), esto se cae solo: `MEDIA_URL` pasa a ser absoluta y
# esta ruta deja de recibir tráfico.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if not settings.DEBUG:
    # `static()` se rinde con DEBUG=False, así que fuera de desarrollo la ruta
    # se declara a mano.
    urlpatterns += [
        re_path(
            r"^%s(?P<path>.*)$" % re.escape(settings.MEDIA_URL.lstrip("/")),
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
