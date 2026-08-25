"""Autenticacion de las conexiones WebSocket.

El navegador no puede mandar cabeceras en el handshake, asi que la credencial
tiene que ir en el query string. Va un boleto de un solo uso -- ver
``common.ws_tickets`` -- y no el JWT: dura treinta segundos, muere al canjearse
y no sirve para hablarle a la API REST. El JWT por query string ya no se
acepta; quien lo mande recibe el mismo trato que quien no manda nada.

La cabecera ``Authorization: Bearer`` se sigue admitiendo para los clientes que
si pueden mandarla -- pruebas, scripts, el agente de impresion -- porque ahi el
motivo para no usarla nunca existio.

El boleto trae dentro el motel ya resuelto: quien lo emitio ya comprobo el
acceso contra ``X-Motel-Id``, de modo que el handshake no repite esa consulta.
"""

from __future__ import annotations

from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_ticket(ticket: str):
    from django.contrib.auth import get_user_model

    from common.ws_tickets import redeem

    payload = redeem(ticket)
    if payload is None:
        return AnonymousUser()

    user_model = get_user_model()
    user = user_model.objects.filter(pk=payload["user_id"], is_active=True).first()
    if user is None:
        return AnonymousUser()

    user.active_motel_id = payload.get("motel_id")
    user.active_access_role = payload.get("role") or user.role
    return user


@database_sync_to_async
def _user_from_token(validated_token, requested_motel_id=None):
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
    """Resuelve ``scope['user']`` a partir del boleto o de la cabecera."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import AccessToken

        scope = dict(scope)
        ticket = self._query_param(scope, "ticket")

        if ticket:
            scope["user"] = await _user_from_ticket(ticket)
            return await self.inner(scope, receive, send)

        token = self._header_token(scope)
        if token:
            try:
                scope["user"] = await _user_from_token(
                    AccessToken(token), self._query_param(scope, "motel_id")
                )
            except TokenError:
                scope["user"] = AnonymousUser()
        else:
            scope.setdefault("user", AnonymousUser())

        return await self.inner(scope, receive, send)

    @staticmethod
    def _header_token(scope: dict) -> str | None:
        for name, value in scope.get("headers", []):
            if name == b"authorization":
                parts = value.decode().split()
                if len(parts) == 2 and parts[0].lower() == "bearer":
                    return parts[1]
        return None

    @staticmethod
    def _query_param(scope: dict, name: str) -> str | None:
        query = parse_qs(scope.get("query_string", b"").decode())
        return query.get(name, [None])[0]


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
