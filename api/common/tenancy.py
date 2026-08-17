"""Motel activo de la petición en curso.

El sistema atiende a varios moteles con una sola base de datos, así que casi
toda consulta tiene que ir acotada al motel de quien pregunta. Ese dato no se
arrastra parámetro por parámetro: viaja en el contexto, igual que el actor de
la auditoría, y los managers de ``common.models`` lo aplican solos.

Se resuelve en dos pasos: si alguien fijó un motel explicito -- una tarea de
Celery, un comando, una prueba -- manda ese; si no, se toma el del usuario
autenticado. Cuando no hay ninguno de los dos, la consulta no se filtra: es el
caso del administrador de la plataforma y el de los procesos que operan sobre
todos los moteles a la vez.
"""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from typing import Iterator

from common.middleware import get_current_user

ALL_MOTELS = object()

_current_motel_id: contextvars.ContextVar = contextvars.ContextVar(
    "current_motel_id", default=None
)


def current_motel_id() -> int | None:
    """Motel que acota las consultas, o ``None`` para no acotarlas."""
    explicit = _current_motel_id.get()
    if explicit is ALL_MOTELS:
        return None
    if explicit is not None:
        return explicit

    user = get_current_user()
    if user is None:
        return None
    return getattr(user, "motel_id", None)


def activate_motel(motel) -> object:
    identifier = getattr(motel, "pk", motel)
    return _current_motel_id.set(identifier)


def deactivate_motel(token=None) -> None:
    if token is not None:
        _current_motel_id.reset(token)
    else:
        _current_motel_id.set(None)


@contextmanager
def use_motel(motel) -> Iterator[None]:
    """Acota un bloque de código a un motel concreto."""
    token = activate_motel(motel)
    try:
        yield
    finally:
        deactivate_motel(token)


@contextmanager
def without_motel() -> Iterator[None]:
    """Levanta el filtro para operar sobre todos los moteles."""
    token = _current_motel_id.set(ALL_MOTELS)
    try:
        yield
    finally:
        _current_motel_id.reset(token)
