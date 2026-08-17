"""Rutas WebSocket del ERP."""

from django.urls import path

from apps.notifications import consumers

websocket_urlpatterns = [
    path("ws/frontdesk/", consumers.FrontDeskConsumer.as_asgi()),
    path("ws/notifications/", consumers.NotificationConsumer.as_asgi()),
]
