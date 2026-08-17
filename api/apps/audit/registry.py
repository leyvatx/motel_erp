"""Registro genérico de modelos auditados.

Se conectan ``pre_save`` (para retener el estado anterior) y ``post_save``
(para escribir el diferencial). Quedan fuera los modelos que ya son de por si
un historial inmutable -- Kardex, log de estados, seguimiento de mantenimiento
y la propia bitácora -- para no duplicar información.
"""

from __future__ import annotations

import logging

from django.apps import apps as django_apps
from django.db.models.signals import post_save, pre_save

from apps.audit.services import record_model_change

logger = logging.getLogger(__name__)

AUDITED_MODELS: tuple[str, ...] = (
    "settings.Motel",
    "users.User",
    "rooms.Room",
    "rooms.RoomType",
    "rooms.TariffBlock",
    "rooms.TariffRule",
    "rooms.Holiday",
    "rooms.Reservation",
    "rooms.Stay",
    "rooms.StayExtension",
    "sales.Folio",
    "sales.FolioCharge",
    "sales.Order",
    "sales.OrderItem",
    "sales.Payment",
    "inventory.Warehouse",
    "inventory.Product",
    "inventory.ProductCategory",
    "inventory.StockLot",
    "housekeeping.CleaningTask",
    "housekeeping.MaintenanceReport",
    "finances.Shift",
    "finances.Expense",
)

_PREVIOUS_ATTR = "_audit_previous"


def _capture_previous(sender, instance, **kwargs) -> None:
    """Guarda en memoria el registro tal como esta en la base."""
    if instance.pk is None or instance._state.adding:
        setattr(instance, _PREVIOUS_ATTR, None)
        return
    try:
        manager = getattr(sender, "all_objects", sender._default_manager)
        setattr(instance, _PREVIOUS_ATTR, manager.get(pk=instance.pk))
    except sender.DoesNotExist:
        setattr(instance, _PREVIOUS_ATTR, None)
    except Exception:
        logger.exception("No se pudo leer el estado previo de %s", sender.__name__)
        setattr(instance, _PREVIOUS_ATTR, None)


def _write_log(sender, instance, created, **kwargs) -> None:
    previous = getattr(instance, _PREVIOUS_ATTR, None)
    record_model_change(instance, previous=None if created else previous)
    if hasattr(instance, _PREVIOUS_ATTR):
        delattr(instance, _PREVIOUS_ATTR)


def connect() -> None:
    """Engancha las señales de todos los modelos auditados."""
    for label in AUDITED_MODELS:
        try:
            model = django_apps.get_model(label)
        except LookupError:
            logger.warning("Modelo auditado inexistente: %s", label)
            continue

        uid = f"audit_{label.replace('.', '_')}"
        pre_save.connect(
            _capture_previous, sender=model, dispatch_uid=f"{uid}_pre", weak=False
        )
        post_save.connect(_write_log, sender=model, dispatch_uid=f"{uid}_post", weak=False)
