"""Punto de entrada ASGI: HTTP tradicional + WebSockets de Channels."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# La app HTTP debe construirse antes de importar consumers, para que el registro
# de aplicaciones de Django ya este cargado.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from core.routing import websocket_urlpatterns  # noqa: E402
from apps.notifications.middleware import JWTAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
