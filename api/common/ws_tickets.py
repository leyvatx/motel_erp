"""Boleto de un solo uso para abrir un WebSocket.

El handshake de WebSocket del navegador no admite cabeceras, asi que algo tiene
que viajar en el query string. Hasta ahora era el JWT de acceso, y de ahi
pasaba al access_log de nginx, al historial de cualquier proxy intermedio y a
las bitacoras de quien estuviera en medio, con treinta minutos de vida por
delante y acceso completo a la API REST.

El boleto cambia eso por un opaco que vive treinta segundos, sirve una sola vez
y no abre nada mas que el socket. Si alguien lo lee en una bitacora, ya no
vale.

Vive en la cache de Redis y no en la base: su vida util es mas corta que lo que
tarda en asentarse una fila, y el canje tiene que ser atomico entre workers.
Esa atomicidad la da ``cache.delete``, que devuelve verdadero unicamente para
quien alcanzo a borrar la llave -- si dos conexiones presentan el mismo boleto
al mismo tiempo, exactamente una gana.
"""

from __future__ import annotations

import secrets
from typing import Any

from django.core.cache import cache

TICKET_TTL_SECONDS = 30

_PREFIX = "ws:ticket:"


def issue(*, user_id: int, motel_id: int | None, role: str) -> str:
    """Emite un boleto para el usuario ya autenticado y su motel resuelto."""
    ticket = secrets.token_urlsafe(32)
    cache.set(
        f"{_PREFIX}{ticket}",
        {"user_id": user_id, "motel_id": motel_id, "role": role},
        TICKET_TTL_SECONDS,
    )
    return ticket


def redeem(ticket: str) -> dict[str, Any] | None:
    """Canjea el boleto y lo invalida. Devuelve ``None`` si ya no sirve."""
    if not ticket:
        return None

    key = f"{_PREFIX}{ticket}"
    payload = cache.get(key)
    if payload is None:
        return None
    if not cache.delete(key):
        return None
    return payload
