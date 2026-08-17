"""Tareas periódicas de inventario: stock mínimo y caducidades."""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.inventory.models import StockLot, WarehouseStock
from apps.notifications.events import Event, broadcast, role_group
from apps.notifications.models import NotificationCategory, NotificationLevel
from apps.notifications.services import notify
from apps.users.constants import Role

logger = logging.getLogger(__name__)

#: Horas de silencio antes de repetir la misma alerta de stock.
LOW_STOCK_COOLDOWN_HOURS = 6
#: Días de anticipacion para avisar de un lote por caducar.
EXPIRY_WARNING_DAYS = 7


@shared_task(name="apps.inventory.tasks.check_low_stock", ignore_result=True)
def check_low_stock() -> int:
    """Avisa a gerencia y almacén de los productos en o bajo su mínimo."""
    now = timezone.now()
    cooldown = now - timedelta(hours=LOW_STOCK_COOLDOWN_HOURS)
    alerted = 0

    with transaction.atomic():
        stocks = list(
            WarehouseStock.objects.select_for_update(skip_locked=True, of=("self",))
            .filter(min_stock__gt=0, quantity__lte=F("min_stock"))
            .filter(low_stock_notified_at__isnull=True)
            .select_related("product", "warehouse")[:200]
        )
        stocks += list(
            WarehouseStock.objects.select_for_update(skip_locked=True, of=("self",))
            .filter(min_stock__gt=0, quantity__lte=F("min_stock"))
            .filter(low_stock_notified_at__lt=cooldown)
            .select_related("product", "warehouse")[:200]
        )

        for stock in stocks:
            stock.low_stock_notified_at = now
            stock.save(update_fields=["low_stock_notified_at", "updated_at"])

            payload = {
                "product_id": stock.product_id,
                "sku": stock.product.sku,
                "product": stock.product.name,
                "warehouse_id": stock.warehouse_id,
                "warehouse": stock.warehouse.name,
                "quantity": str(stock.quantity),
                "min_stock": str(stock.min_stock),
            }
            broadcast(
                Event.STOCK_LOW,
                payload,
                groups=[role_group(Role.MANAGER), role_group(Role.SUPERADMIN)],
            )
            notify(
                category=NotificationCategory.LOW_STOCK,
                level=NotificationLevel.WARNING,
                title=f"Stock minimo: {stock.product.name}",
                body=(
                    f"Quedan {stock.quantity} en {stock.warehouse.name} "
                    f"(minimo {stock.min_stock})."
                ),
                target_role=Role.MANAGER,
                payload=payload,
            )
            alerted += 1

    if alerted:
        logger.info("Alertas de stock mínimo emitidas: %s", alerted)
    return alerted


@shared_task(name="apps.inventory.tasks.check_expiring_lots", ignore_result=True)
def check_expiring_lots(days: int = EXPIRY_WARNING_DAYS) -> int:
    """Avisa de lotes por caducar o ya caducados con existencia."""
    today = timezone.localdate()
    limit = today + timedelta(days=days)
    alerted = 0

    with transaction.atomic():
        lots = list(
            StockLot.objects.select_for_update(skip_locked=True, of=("self",))
            .filter(
                is_active=True,
                quantity__gt=0,
                expiration_date__isnull=False,
                expiration_date__lte=limit,
                expiry_notified_at__isnull=True,
            )
            .select_related("product", "warehouse")[:200]
        )

        for lot in lots:
            lot.expiry_notified_at = timezone.now()
            lot.save(update_fields=["expiry_notified_at", "updated_at"])

            vencido = lot.expiration_date < today
            payload = {
                "lot_id": lot.pk,
                "product": lot.product.name,
                "sku": lot.product.sku,
                "warehouse": lot.warehouse.name,
                "quantity": str(lot.quantity),
                "expiration_date": lot.expiration_date.isoformat(),
                "expired": vencido,
            }
            broadcast(
                Event.STOCK_EXPIRING,
                payload,
                groups=[role_group(Role.MANAGER), role_group(Role.SUPERADMIN)],
            )
            notify(
                category=NotificationCategory.EXPIRING_LOT,
                level=NotificationLevel.CRITICAL if vencido else NotificationLevel.WARNING,
                title=("Producto caducado" if vencido else "Producto por caducar"),
                body=(
                    f"{lot.product.name} en {lot.warehouse.name}: "
                    f"{lot.quantity} pza(s), vence {lot.expiration_date:%d/%m/%Y}."
                ),
                target_role=Role.MANAGER,
                payload=payload,
            )
            alerted += 1

    if alerted:
        logger.info("Alertas de caducidad emitidas: %s", alerted)
    return alerted
