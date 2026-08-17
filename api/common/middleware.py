"""Contexto de request accesible desde signals y services.

La auditoría (Fase 6) necesita saber *quien* y *desde dónde* se ejecutó un
cambio, incluso cuando el cambio ocurre dentro de un ``post_save``. Se usa
``contextvars`` (no ``threading.local``) para que funcione también bajo ASGI.
"""

from __future__ import annotations

import contextvars
from typing import Any, Callable

_current_request: contextvars.ContextVar[Any | None] = contextvars.ContextVar(
    "current_request", default=None
)
_current_user: contextvars.ContextVar[Any | None] = contextvars.ContextVar(
    "current_user", default=None
)
_current_ip: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_ip", default=None
)
_current_user_agent: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_user_agent", default=""
)


def get_current_user():
    """Usuario autenticado del request en curso, o ``None`` en tareas de Celery.

    Se guarda el request y no el usuario porque con JWT la autenticación
    ocurre dentro de la vista, después del middleware: si aquí se copiara el
    usuario tal como esta al entrar, siempre seria el anónimo. Leyendo el
    atributo en el momento en que se pregunta, ya viene resuelto.
    """
    user = _current_user.get()
    if user is None:
        request = _current_request.get()
        user = getattr(request, "user", None) if request is not None else None

    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def get_current_ip() -> str | None:
    return _current_ip.get()


def get_current_user_agent() -> str:
    return _current_user_agent.get()


def set_actor(user=None, ip: str | None = None, user_agent: str = "") -> None:
    """Fija el actor manualmente (útil en tareas de Celery y comandos)."""
    _current_user.set(user)
    _current_ip.set(ip)
    _current_user_agent.set(user_agent)


def extract_client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class PresenceMiddleware:
    """Registra actividad real del empleado en cada petición autenticada.

    Va después de la autenticación de DRF, así que se apoya en el usuario ya
    resuelto por el request. La escritura está limitada por tiempo dentro del
    servicio de presencia para no golpear la base en cada llamada.
    """

    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            try:
                from apps.users.presence import touch_if_stale

                touch_if_stale(user)
            except Exception:
                pass

        return response


class CurrentRequestMiddleware:
    """Publica usuario, IP y user-agent del request actual en el contexto."""

    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        request_token = _current_request.set(request)
        ip_token = _current_ip.set(extract_client_ip(request))
        ua_token = _current_user_agent.set(request.META.get("HTTP_USER_AGENT", "")[:255])
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(request_token)
            _current_ip.reset(ip_token)
            _current_user_agent.reset(ua_token)
