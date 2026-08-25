"""Sondeo de vida del contenedor: base de datos y caché.

Es una vista de Django a secas, no de DRF: el sondeo entra sin sesión y sin
motel, y las clases de permiso por omisión de la API lo rechazarían. Por lo
mismo queda exenta de la redirección a HTTPS en ``SECURE_REDIRECT_EXEMPT``,
porque Docker la consulta por loopback y en claro.

Responde 200 solo si ambas dependencias contestan. Cuando algo falla, el 503
dice cuál de las dos fue: distinguir "se cayó la base" de "se cayó Redis" sin
entrar a leer bitácoras es la única razón por la que este endpoint existe.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

PROBE_KEY = "health:probe"


def _probe(operation) -> str:
    try:
        operation()
    except Exception as exc:
        return f"error: {exc.__class__.__name__}"
    return "ok"


def _database() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


def _cache() -> None:
    cache.set(PROBE_KEY, "1", 10)
    if cache.get(PROBE_KEY) != "1":
        raise RuntimeError("La caché no devolvió lo que se acaba de guardar.")


def health(request) -> JsonResponse:
    """Estado de las dependencias que la API necesita para operar."""
    estado = {"database": _probe(_database), "cache": _probe(_cache)}
    sano = all(valor == "ok" for valor in estado.values())
    return JsonResponse(estado, status=200 if sano else 503)
