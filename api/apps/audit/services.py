"""Escritura de la bitácora.

``record`` es la única puerta de entrada. Toma el actor y la IP del contexto
del request (``common.middleware``) cuando no se los pasan, de modo que un
signal profundo no tenga que arrastrar el usuario a mano.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import models

from common.middleware import get_current_ip, get_current_user, get_current_user_agent

from apps.audit.constants import APP_MODULE_MAP, SENSITIVE_FIELDS, AuditAction, AuditModule
from apps.audit.models import AuditLog

logger = logging.getLogger(__name__)


def _serialize(value: Any) -> Any:
    """Deja el valor en algo que JSON acepte sin perder legibilidad."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, models.Model):
        return {"id": value.pk, "repr": str(value)[:120]}
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)[:255]


def module_for(instance) -> str:
    return APP_MODULE_MAP.get(instance._meta.app_label, AuditModule.CONFIG)


def diff_instances(previous, current, exclude: set[str] | None = None) -> dict[str, dict]:
    """Campos que cambiaron entre dos versiones del mismo registro."""
    excluded = SENSITIVE_FIELDS | (exclude or set())
    cambios: dict[str, dict] = {}

    for field in current._meta.concrete_fields:
        nombre = field.name
        if nombre in excluded:
            continue
        antes = getattr(previous, field.attname, None)
        ahora = getattr(current, field.attname, None)
        if antes != ahora:
            cambios[nombre] = {"before": _serialize(antes), "after": _serialize(ahora)}
    return cambios


def snapshot(instance, exclude: set[str] | None = None) -> dict[str, Any]:
    """Valores actuales del registro, listos para la bitácora."""
    excluded = SENSITIVE_FIELDS | (exclude or set())
    return {
        field.name: _serialize(getattr(instance, field.attname, None))
        for field in instance._meta.concrete_fields
        if field.name not in excluded
    }


def record(
    *,
    action: str,
    instance=None,
    actor=None,
    module: str | None = None,
    description: str = "",
    changes: dict | None = None,
    extra: dict | None = None,
) -> AuditLog | None:
    """Escribe un renglón de bitácora.

    Nunca levanta: si la auditoría falla, se registra el error pero no se
    tumba la operación de negocio que la originó.
    """
    try:
        actor = actor or get_current_user()
        content_type = (
            ContentType.objects.get_for_model(instance.__class__) if instance is not None else None
        )
        return AuditLog.objects.create(
            actor=actor,
            actor_username=getattr(actor, "username", "") or "",
            action=action,
            module=module or (module_for(instance) if instance is not None else AuditModule.CONFIG),
            description=description[:255],
            content_type=content_type,
            object_id=instance.pk if instance is not None else None,
            object_repr=str(instance)[:180] if instance is not None else "",
            changes=changes or {},
            extra=extra or {},
            ip_address=get_current_ip(),
            user_agent=get_current_user_agent(),
        )
    except Exception:
        logger.exception("No se pudo escribir la bitácora de auditoría (%s).", action)
        return None


def record_model_change(instance, previous=None, actor=None) -> AuditLog | None:
    """Traduce un guardado de modelo a un renglón de bitácora."""
    if previous is None:
        return record(
            action=AuditAction.CREATE,
            instance=instance,
            actor=actor,
            description=f"Alta de {instance._meta.verbose_name}",
            changes={},
            extra={"snapshot": snapshot(instance)},
        )

    cambios = diff_instances(previous, instance)
    if not cambios:
        return None

    if "is_active" in cambios:
        activo = cambios["is_active"]["after"]
        accion = AuditAction.RESTORE if activo else AuditAction.SOFT_DELETE
    else:
        accion = AuditAction.UPDATE

    return record(
        action=accion,
        instance=instance,
        actor=actor,
        description=f"{instance._meta.verbose_name}: {', '.join(sorted(cambios))}"[:255],
        changes=cambios,
    )
