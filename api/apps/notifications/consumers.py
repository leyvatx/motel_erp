"""Consumers de Channels.

Dos canales:
* ``/ws/frontdesk/`` - grid de habitaciones, cronómetros y ordenes.
* ``/ws/notifications/`` - campana del topbar.

Ambos exigen un JWT válido (``?token=<access>``); una conexión anonima se
cierra con código 4401. Los consumers son de solo lectura: el cliente no puede
mutar estado por WebSocket, para eso esta la API REST.
"""

from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.notifications.events import (
    GROUP_FRONTDESK,
    GROUP_NOTIFICATIONS,
    GROUP_ORDERS,
    role_group,
    user_group,
)

logger = logging.getLogger(__name__)

CLOSE_UNAUTHORIZED = 4401


class AuthenticatedConsumer(AsyncJsonWebsocketConsumer):
    """Base con autenticación JWT y manejo de grupos."""

    groups_for_user: list[str] = []

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not user.is_authenticated or not user.is_active:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return

        self.user = user
        self._groups = self.get_groups(user)
        for group in self._groups:
            await self.channel_layer.group_add(group, self.channel_name)

        await self._presence_connect(user)
        await self.accept()
        await self.send_json(
            {
                "event": "connection.ready",
                "payload": {
                    "user_id": user.pk,
                    "role": user.role,
                    "groups": self._groups,
                },
            }
        )

    async def disconnect(self, code: int) -> None:
        for group in getattr(self, "_groups", []):
            await self.channel_layer.group_discard(group, self.channel_name)

        user = getattr(self, "user", None)
        if user is not None:
            await self._presence_disconnect(user)

    def get_groups(self, user) -> list[str]:
        raise NotImplementedError

    async def receive_json(self, content: dict, **kwargs) -> None:
        """Solo se admite ping: mantiene viva la conexión y la presencia."""
        if content.get("action") == "ping":
            user = getattr(self, "user", None)
            if user is not None:
                section = str(content.get("section", ""))[:40]
                await self._presence_touch(user, section)
            await self.send_json({"event": "pong", "payload": {}})

    # -- Presencia ---------------------------------------------------------
    @database_sync_to_async
    def _presence_connect(self, user) -> None:
        from apps.users import presence

        presence.mark_connected(user)

    @database_sync_to_async
    def _presence_disconnect(self, user) -> None:
        from apps.users import presence

        presence.mark_disconnected(user)

    @database_sync_to_async
    def _presence_touch(self, user, section: str) -> None:
        from apps.users import presence

        presence.touch(user, section)

    async def broadcast_event(self, message: dict) -> None:
        """Reenvia al cliente lo publicado por ``events.broadcast``."""
        await self.send_json(
            {
                "event": message["event"],
                "payload": message["payload"],
                "timestamp": message["timestamp"],
            }
        )


class FrontDeskConsumer(AuthenticatedConsumer):
    """Estado del grid: cuartos, rentas, cronómetros y ordenes."""

    def get_groups(self, user) -> list[str]:
        return [GROUP_FRONTDESK, GROUP_ORDERS, role_group(user.role)]


class NotificationConsumer(AuthenticatedConsumer):
    """Campana del topbar: avisos dirigidos al rol o al usuario."""

    def get_groups(self, user) -> list[str]:
        return [GROUP_NOTIFICATIONS, role_group(user.role), user_group(user.pk)]
