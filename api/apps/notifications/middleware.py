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
def _get_user(validated_token):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.settings import api_settings

    user_model = get_user_model()
    try:
        user_id = validated_token[api_settings.USER_ID_CLAIM]
        return user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
    except (KeyError, user_model.DoesNotExist):
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
                scope["user"] = await _get_user(AccessToken(token))
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


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
