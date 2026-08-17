"""Motor de existencias y Kardex.

Toda entrada o salida de inventario pasa por aquí. Reglas:
* La fila ``WarehouseStock`` se bloquea con ``select_for_update`` antes de
  tocar el saldo: dos meseros no pueden vender la última cerveza.
* El Kardex se escribe siempre, incluso en cancelaciones (con un movimiento
  en sentido contrario, nunca borrando el original).
* Los productos con caducidad consumen lotes por PEPS de vencimiento (FEFO).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from common.exceptions import DomainError, InsufficientStock
from common.utils import ZERO, quantity as q

from apps.inventory import signals
from apps.inventory.constants import MOVEMENT_SIGN, MovementType
from apps.inventory.models import (
    Product,
    StockLot,
    StockMovement,
    Warehouse,
    WarehouseStock,
)


def get_or_create_stock(product: Product, warehouse: Warehouse) -> WarehouseStock:
    stock, _ = WarehouseStock.objects.get_or_create(
        product=product,
        warehouse=warehouse,
        defaults={"min_stock": product.default_min_stock},
    )
    return stock


def lock_stock(product: Product, warehouse: Warehouse) -> WarehouseStock:
    """Bloquea (o crea) la fila de existencias para operar sin condiciones de carrera."""
    get_or_create_stock(product, warehouse)
    return (
        WarehouseStock.objects.select_for_update()
        .select_related("product", "warehouse")
        .get(product=product, warehouse=warehouse)
    )


@transaction.atomic
def apply_movement(
    *,
    product: Product,
    warehouse: Warehouse,
    movement_type: str,
    quantity: Decimal,
    actor=None,
    unit_cost: Decimal | None = None,
    lot: StockLot | None = None,
    reason: str = "",
    source_document=None,
    reversal_of: StockMovement | None = None,
    allow_negative: bool = False,
) -> StockMovement:
    """Registra un movimiento y actualiza el saldo del almacén.

    Devuelve el renglón del Kardex ya persistido.
    """
    qty = q(quantity)
    if qty <= ZERO:
        raise DomainError("La cantidad del movimiento debe ser mayor a cero.", code="invalid_quantity")

    sign = MOVEMENT_SIGN[movement_type]
    stock = lock_stock(product, warehouse)
    new_balance = q(stock.quantity + (qty * sign))

    if new_balance < ZERO and not allow_negative:
        raise InsufficientStock(
            detail=(
                f"No hay suficiente '{product.name}' en '{warehouse.name}'. "
                f"Disponible: {stock.quantity}, solicitado: {qty}."
            ),
            product_id=product.pk,
            warehouse_id=warehouse.pk,
            available=str(stock.quantity),
            requested=str(qty),
        )

    stock.quantity = new_balance
    stock.save(update_fields=["quantity", "updated_at"])

    if lot is not None:
        lot.quantity = q(lot.quantity + (qty * sign))
        if lot.quantity < ZERO:
            raise InsufficientStock(
                detail=f"El lote {lot.lot_code or lot.pk} no tiene existencias suficientes.",
                lot_id=lot.pk,
            )
        lot.save(update_fields=["quantity", "updated_at"])

    movement = StockMovement(
        product=product,
        warehouse=warehouse,
        lot=lot,
        movement_type=movement_type,
        quantity=qty,
        balance_after=new_balance,
        unit_cost=unit_cost if unit_cost is not None else product.average_cost,
        reason=reason,
        performed_by=actor,
        reversal_of=reversal_of,
    )
    if source_document is not None:
        movement.source_document = source_document
    movement.save()

    if sign > 0 and unit_cost is not None:
        _update_costs(product, unit_cost, qty, previous_balance=new_balance - qty)

    signals.stock_movement_registered.send(
        sender=StockMovement, movement=movement, actor=actor
    )
    return movement


def _update_costs(product: Product, unit_cost: Decimal, qty: Decimal, previous_balance: Decimal) -> None:
    """Costeo promedio ponderado. Solo aplica en entradas con costo conocido."""
    previous_balance = max(previous_balance, ZERO)
    total_units = previous_balance + qty
    if total_units > ZERO:
        product.average_cost = (
            (product.average_cost * previous_balance) + (unit_cost * qty)
        ) / total_units
    product.last_cost = unit_cost
    product.save(update_fields=["average_cost", "last_cost", "updated_at"])


@transaction.atomic
def register_entry(
    *,
    product: Product,
    warehouse: Warehouse,
    quantity: Decimal,
    actor=None,
    movement_type: str = MovementType.PURCHASE,
    unit_cost: Decimal | None = None,
    lot_code: str = "",
    expiration_date=None,
    reason: str = "",
    source_document=None,
) -> StockMovement:
    """Entrada de mercancia. Crea el lote cuando el producto controla caducidad."""
    lot = None
    if product.track_expiration:
        lot = StockLot.objects.create(
            product=product,
            warehouse=warehouse,
            lot_code=lot_code,
            expiration_date=expiration_date,
            quantity=ZERO,
            unit_cost=unit_cost or product.last_cost,
            received_at=timezone.now(),
            created_by=actor,
        )
    return apply_movement(
        product=product,
        warehouse=warehouse,
        movement_type=movement_type,
        quantity=quantity,
        actor=actor,
        unit_cost=unit_cost,
        lot=lot,
        reason=reason,
        source_document=source_document,
    )


@transaction.atomic
def register_exit(
    *,
    product: Product,
    warehouse: Warehouse,
    quantity: Decimal,
    actor=None,
    movement_type: str = MovementType.SALE,
    reason: str = "",
    source_document=None,
) -> list[StockMovement]:
    """Salida de mercancia.

    Si el producto controla caducidad, la cantidad se reparte entre lotes
    ordenados por fecha de vencimiento (FEFO) y se genera un renglón de Kardex
    por cada lote consumido.
    """
    if not product.is_stockable:
        return []

    qty = q(quantity)
    if not product.track_expiration:
        return [
            apply_movement(
                product=product,
                warehouse=warehouse,
                movement_type=movement_type,
                quantity=qty,
                actor=actor,
                reason=reason,
                source_document=source_document,
            )
        ]

    lots = list(
        StockLot.objects.select_for_update()
        .filter(product=product, warehouse=warehouse, is_active=True, quantity__gt=ZERO)
        .order_by("expiration_date", "received_at")
    )
    available = sum((lot.quantity for lot in lots), ZERO)
    if available < qty:
        raise InsufficientStock(
            detail=(
                f"Lotes insuficientes de '{product.name}' en '{warehouse.name}'. "
                f"Disponible: {available}, solicitado: {qty}."
            ),
            product_id=product.pk,
            warehouse_id=warehouse.pk,
        )

    movements: list[StockMovement] = []
    pending = qty
    for lot in lots:
        if pending <= ZERO:
            break
        take = min(lot.quantity, pending)
        movements.append(
            apply_movement(
                product=product,
                warehouse=warehouse,
                movement_type=movement_type,
                quantity=take,
                actor=actor,
                unit_cost=lot.unit_cost,
                lot=lot,
                reason=reason,
                source_document=source_document,
            )
        )
        pending -= take
    return movements


@transaction.atomic
def reverse_movements(
    movements: Iterable[StockMovement],
    *,
    actor=None,
    reason: str = "",
    movement_type: str = MovementType.RETURN_IN,
) -> list[StockMovement]:
    """Devuelve al inventario lo descargado por una orden cancelada.

    No borra ni edita el Kardex original: escribe el contrario y lo enlaza.
    """
    reversals: list[StockMovement] = []
    for original in movements:
        if hasattr(original, "reversal"):
            continue
        reversals.append(
            apply_movement(
                product=original.product,
                warehouse=original.warehouse,
                movement_type=movement_type,
                quantity=original.quantity,
                actor=actor,
                unit_cost=original.unit_cost,
                lot=original.lot,
                reason=reason or "Reversa de movimiento",
                source_document=original.source_document,
                reversal_of=original,
            )
        )
    return reversals


@transaction.atomic
def transfer_stock(
    *,
    product: Product,
    source_warehouse: Warehouse,
    target_warehouse: Warehouse,
    quantity: Decimal,
    actor=None,
    reason: str = "",
) -> tuple[list[StockMovement], StockMovement]:
    """Traspaso entre almacenes: salida y entrada en la misma transacción."""
    if source_warehouse.pk == target_warehouse.pk:
        raise DomainError("El almacén origen y el destino son el mismo.", code="same_warehouse")

    salidas = register_exit(
        product=product,
        warehouse=source_warehouse,
        quantity=quantity,
        actor=actor,
        movement_type=MovementType.TRANSFER_OUT,
        reason=reason or f"Traspaso a {target_warehouse.name}",
    )
    entrada = apply_movement(
        product=product,
        warehouse=target_warehouse,
        movement_type=MovementType.TRANSFER_IN,
        quantity=quantity,
        actor=actor,
        unit_cost=product.average_cost,
        reason=reason or f"Traspaso desde {source_warehouse.name}",
    )
    return salidas, entrada


@transaction.atomic
def register_waste(
    *,
    product: Product,
    warehouse: Warehouse,
    quantity: Decimal,
    actor,
    reason: str,
    lot: StockLot | None = None,
    expired: bool = False,
) -> list[StockMovement]:
    """Merma o caducidad. Siempre exige motivo: nada sale del almacén sin razón."""
    if not reason:
        raise DomainError("La merma requiere un motivo.", code="reason_required")

    movement_type = MovementType.EXPIRED if expired else MovementType.WASTE
    if lot is not None:
        return [
            apply_movement(
                product=product,
                warehouse=warehouse,
                movement_type=movement_type,
                quantity=quantity,
                actor=actor,
                unit_cost=lot.unit_cost,
                lot=lot,
                reason=reason,
            )
        ]
    return register_exit(
        product=product,
        warehouse=warehouse,
        quantity=quantity,
        actor=actor,
        movement_type=movement_type,
        reason=reason,
    )


@transaction.atomic
def adjust_stock(
    *,
    product: Product,
    warehouse: Warehouse,
    counted_quantity: Decimal,
    actor,
    reason: str,
) -> StockMovement | None:
    """Ajusta por conteo físico y deja el diferencial asentado en el Kardex."""
    if not reason:
        raise DomainError("El ajuste requiere un motivo.", code="reason_required")

    stock = lock_stock(product, warehouse)
    contado = q(counted_quantity)
    diferencia = contado - stock.quantity
    if diferencia == ZERO:
        return None

    movement_type = (
        MovementType.ADJUSTMENT_IN if diferencia > ZERO else MovementType.ADJUSTMENT_OUT
    )
    return apply_movement(
        product=product,
        warehouse=warehouse,
        movement_type=movement_type,
        quantity=abs(diferencia),
        actor=actor,
        unit_cost=product.average_cost,
        reason=f"Conteo fisico: {reason}"[:255],
    )


def movements_for(source_document) -> list[StockMovement]:
    """Movimientos de Kardex generados por un documento origen."""
    from django.contrib.contenttypes.models import ContentType

    content_type = ContentType.objects.get_for_model(source_document.__class__)
    return list(
        StockMovement.objects.select_related("product", "warehouse", "lot").filter(
            content_type=content_type, object_id=source_document.pk, reversal__isnull=True
        )
    )
