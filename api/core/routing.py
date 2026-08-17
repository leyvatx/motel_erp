"""Ruteo de WebSockets (Channels).

Los consumers concretos se implementan en la Fase 3
(``apps.notifications.consumers``).
"""

from apps.notifications import routing as notifications_routing

websocket_urlpatterns = [
    *notifications_routing.websocket_urlpatterns,
]
