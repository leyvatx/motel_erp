"""Excepciones de dominio y manejador global de errores de la API.

Todas las respuestas de error de la API comparten la misma envoltura:

```json
{"error": {"code": "insufficient_stock", "message": "...", "details": {...}}}
```
"""

from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


class DomainError(APIException):
    """Violacion de una regla de negocio.

    Se levanta desde la capa de servicios; nunca desde las vistas.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "La operación viola una regla de negocio."
    default_code = "business_rule_error"

    def __init__(self, detail: str | None = None, code: str | None = None, **details: Any):
        super().__init__(detail=detail, code=code)
        self.details: dict[str, Any] = details


class InvalidStateTransition(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "La transición de estado solicitada no está permitida."
    default_code = "invalid_state_transition"


class InsufficientStock(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Existencias insuficientes para completar la operación."
    default_code = "insufficient_stock"


class ResourceUnavailable(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "El recurso solicitado no está disponible."
    default_code = "resource_unavailable"


class ImmutableRecordError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "El registro es inmutable."
    default_code = "immutable_record"


class ShiftRequiredError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Se requiere un turno de caja abierto para esta operación."
    default_code = "shift_required"


def _normalize(detail: Any) -> Any:
    """Convierte los ErrorDetail anidados de DRF en tipos JSON planos."""
    if isinstance(detail, list):
        return [_normalize(item) for item in detail]
    if isinstance(detail, dict):
        return {key: _normalize(value) for key, value in detail.items()}
    return str(detail)


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Manejador global: unifica el formato de error de toda la API."""
    if isinstance(exc, DjangoValidationError):
        exc = APIException(detail=_normalize(exc.message_dict if hasattr(exc, "message_dict") else exc.messages))
        exc.status_code = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, IntegrityError):
        logger.warning("IntegrityError en %s: %s", context.get("view"), exc)
        exc = DomainError(
            detail="La operación choca con una restriccion de integridad de datos.",
            code="integrity_error",
        )
    elif isinstance(exc, PermissionDenied):
        from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied

        exc = DRFPermissionDenied()
    elif isinstance(exc, Http404):
        from rest_framework.exceptions import NotFound

        exc = NotFound()

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Error no controlado en %s", context.get("view"))
        return None

    # ErrorDetail conserva el ``code`` puntual que levantó el service; si no
    # lo trae, se cae al code por defecto de la clase de excepción.
    code = getattr(getattr(exc, "detail", None), "code", None) or getattr(
        exc, "default_code", "error"
    )
    if isinstance(exc, APIException) and isinstance(exc.detail, (list, dict)):
        message = "Los datos enviados no son válidos."
        details = _normalize(exc.detail)
    else:
        message = _normalize(response.data.get("detail", response.data))
        details = getattr(exc, "details", {})

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }
    return response
