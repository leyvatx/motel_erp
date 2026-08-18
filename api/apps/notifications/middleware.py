"""Autenticación JWT para conexiones WebSocket.

El navegador no puede mandar cabeceras en el handshake de WebSocket, así que
el token viaja en el query string (``?token=<access>``) o en el subprotocolo.
El token se valida con la misma llave de SimpleJWT que usa la API REST.
"""

from __future__ import annotations

from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user(validated_token, requested_motel_id=None):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.settings import api_settings

    user_model = get_user_model()
    try:
        user_id = validated_token[api_settings.USER_ID_CLAIM]
        user = user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
        if requested_motel_id is None:
            return user
        motel_id = int(requested_motel_id)
        if user.motel_id is not None:
            if user.motel_id != motel_id:
                return AnonymousUser()
            user.active_motel_id = user.motel_id
            user.active_access_role = user.role
            return user
        if user.is_platform_admin:
            return user
        from apps.corporate.services import access_role
        role = access_role(user, motel_id)
        if not role:
            return AnonymousUser()
        user.active_motel_id = motel_id
        user.active_access_role = role
        return user
    except (KeyError, TypeError, ValueError, user_model.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware:
    """Resuelve ``scope['user']`` a partir del access token."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import AccessToken

        scope = dict(scope)
        token = self._extract_token(scope)

        if token:
            try:
                scope["user"] = await _get_user(AccessToken(token), self._motel_id(scope))
            except TokenError:
                scope["user"] = AnonymousUser()
        else:
            scope.setdefault("user", AnonymousUser())

        return await self.inner(scope, receive, send)

    @staticmethod
    def _extract_token(scope: dict) -> str | None:
        query = parse_qs(scope.get("query_string", b"").decode())
        if "token" in query:
            return query["token"][0]

        for name, value in scope.get("headers", []):
            if name == b"authorization":
                parts = value.decode().split()
                if len(parts) == 2 and parts[0].lower() == "bearer":
                    return parts[1]
        return None

    @staticmethod
    def _motel_id(scope: dict) -> str | None:
        query = parse_qs(scope.get("query_string", b"").decode())
        return query.get("motel_id", [None])[0]


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
