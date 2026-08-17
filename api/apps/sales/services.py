"""Capa de servicios de la cuenta abierta (Folio), consumos y cobro.

Convencion de importes: ``FolioCharge.amount`` y ``OrderItem.line_total`` son
lo que el huesped paga por ese renglón, con impuesto incluido. ``tax_amount``
es el impuesto contenido en ese importe (informativo para reportes).

Todo lo que mueva dinero o inventario corre dentro de ``transaction.atomic``
y bloquea el folio con ``select_for_update`` para evitar que recepción y room
service cobren o carguen en paralelo sobre la misma cuenta.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence, TypedDict

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from common.exceptions import DomainError
from common.models import DocumentSequence
from common.utils import ZERO, money, period_key, quantity as q

from apps.inventory.constants import MovementType
from apps.inventory.models import Product, Warehouse
from apps.inventory.services import movements_for, register_exit, reverse_movements
from apps.sales import signals
from apps.sales.constants import (
    ChargeType,
    FolioStatus,
    FolioType,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
)
from apps.sales.models import Folio, FolioCharge, Order, OrderItem, Payment


class OrderItemInput(TypedDict, total=False):
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    discount_amount: Decimal
    notes: str


def _next_folio_code() -> str:
    return DocumentSequence.next_value("folio", "F", period_key())


def _next_order_code() -> str:
    return DocumentSequence.next_value("order", "O", period_key())


def lock_folio(folio_id: int) -> Folio:
    """Bloquea la cuenta.

    Se usa ``of=("self",)`` porque ``stay`` y ``room`` son nulables: PostgreSQL
    no admite FOR UPDATE sobre el lado nulable de un LEFT JOIN.
    """
    return (
        Folio.objects.select_for_update(of=("self",))
        .select_related("stay", "room")
        .get(pk=folio_id, is_active=True)
    )


@transaction.atomic
def open_folio(
    *,
    actor,
    stay=None,
    room=None,
    folio_type: str = FolioType.ROOM,
    notes: str = "",
) -> Folio:
    """Abre la cuenta. Una renta solo puede tener un folio (OneToOne)."""
    if stay is not None and Folio.all_objects.filter(stay=stay).exists():
        raise DomainError("La renta ya tiene un folio abierto.", code="folio_already_exists")

    return Folio.objects.create(
        code=_next_folio_code(),
        folio_type=folio_type,
        stay=stay,
        room=room or (stay.room if stay else None),
        opened_at=timezone.now(),
        notes=notes,
        created_by=actor,
    )


def recalculate_folio(folio: Folio) -> Folio:
    """Recalcula totales desde los cargos y pagos vigentes.

    Se llama siempre dentro de la transacción que modifico la cuenta.
    """
    charges = folio.charges.filter(is_active=True, cancelled_at__isnull=True)
    positive = charges.exclude(amount__lt=ZERO).aggregate(total=Sum("amount"))["total"] or ZERO
    negative = charges.filter(amount__lt=ZERO).aggregate(total=Sum("amount"))["total"] or ZERO
    taxes = charges.aggregate(total=Sum("tax_amount"))["total"] or ZERO
    paid = (
        folio.payments.filter(is_active=True, status=PaymentStatus.APPLIED).aggregate(
            total=Sum("amount")
        )["total"]
        or ZERO
    )

    folio.subtotal = money(positive)
    folio.discount_total = money(abs(negative))
    folio.tax_total = money(taxes)
    folio.total = money(positive + negative)
    folio.paid_total = money(paid)
    folio.save(
        update_fields=[
            "subtotal",
            "discount_total",
            "tax_total",
            "total",
            "paid_total",
            "updated_at",
        ]
    )
    return folio


@transaction.atomic
def add_charge(
    *,
    folio: Folio,
    charge_type: str,
    description: str,
    unit_price: Decimal,
    actor,
    quantity: Decimal = Decimal("1"),
    tax_amount: Decimal = ZERO,
    order: Order | None = None,
    stay_extension=None,
) -> FolioCharge:
    """Agrega un renglón a la cuenta abierta y refresca los totales."""
    if folio.status != FolioStatus.OPEN:
        raise DomainError(
            "No se pueden agregar cargos a un folio que no está abierto.",
            code="folio_not_open",
            folio_status=folio.status,
        )

    amount = money(Decimal(unit_price) * Decimal(quantity))
    if charge_type == ChargeType.DISCOUNT:
        amount = -abs(amount)

    charge = FolioCharge.objects.create(
        folio=folio,
        charge_type=charge_type,
        description=description[:180],
        quantity=q(quantity),
        unit_price=money(unit_price),
        tax_amount=money(tax_amount),
        amount=amount,
        order=order,
        stay_extension=stay_extension,
        created_by=actor,
    )
    recalculate_folio(folio)
    return charge


@transaction.atomic
def cancel_charge(*, charge_id: int, reason: str, actor) -> FolioCharge:
    """Cancela un cargo. Nunca se borra: queda marcado y auditado."""
    charge = (
        FolioCharge.objects.select_for_update(of=("self",))
        .select_related("folio", "order")
        .get(pk=charge_id)
    )
    folio = lock_folio(charge.folio_id)

    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio ya está cerrado.", code="folio_not_open")
    if charge.cancelled_at is not None:
        raise DomainError("El cargo ya estaba cancelado.", code="charge_already_cancelled")
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    if charge.order_id:
        cancel_order(order_id=charge.order_id, reason=reason, actor=actor, _skip_charge=True)

    charge.cancelled_at = timezone.now()
    charge.cancelled_by = actor
    charge.cancellation_reason = reason[:255]
    charge.is_active = False
    charge.deleted_at = timezone.now()
    charge.deleted_by = actor
    charge.deletion_reason = reason[:255]
    charge.save(
        update_fields=[
            "cancelled_at",
            "cancelled_by",
            "cancellation_reason",
            "is_active",
            "deleted_at",
            "deleted_by",
            "deletion_reason",
            "updated_at",
        ]
    )
    recalculate_folio(folio)
    return charge


@transaction.atomic
def apply_discount(*, folio_id: int, amount: Decimal, reason: str, actor) -> FolioCharge:
    folio = lock_folio(folio_id)
    if Decimal(amount) <= ZERO:
        raise DomainError("El descuento debe ser mayor a cero.", code="invalid_discount")
    if money(amount) > folio.total:
        raise DomainError(
            "El descuento no puede exceder el total de la cuenta.", code="discount_too_large"
        )
    return add_charge(
        folio=folio,
        charge_type=ChargeType.DISCOUNT,
        description=f"Descuento: {reason}"[:180],
        unit_price=money(amount),
        actor=actor,
    )


@transaction.atomic
def create_order(
    *,
    folio_id: int,
    warehouse_id: int,
    items: Sequence[OrderItemInput],
    actor,
    order_type: str = OrderType.ROOM_SERVICE,
    notes: str = "",
) -> Order:
    """Registra un consumo, descuenta inventario y lo carga al folio.

    El descuento de inventario y el cargo a la cuenta ocurren en la misma
    transacción: o pasan los dos, o no pasa ninguno.
    """
    if not items:
        raise DomainError("La orden necesita al menos un producto.", code="empty_order")

    folio = lock_folio(folio_id)
    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio no admite consumos.", code="folio_not_open")

    warehouse = Warehouse.objects.get(pk=warehouse_id, is_active=True)

    order = Order.objects.create(
        code=_next_order_code(),
        folio=folio,
        order_type=order_type,
        status=OrderStatus.PLACED,
        warehouse=warehouse,
        placed_at=timezone.now(),
        notes=notes,
        created_by=actor,
    )

    product_ids = [item["product_id"] for item in items]
    products = {
        product.pk: product
        for product in Product.objects.filter(pk__in=product_ids, is_active=True)
    }
    missing = set(product_ids) - set(products)
    if missing:
        raise DomainError(
            "Hay productos inexistentes o dados de baja en la orden.",
            code="invalid_product",
            product_ids=sorted(missing),
        )

    subtotal = ZERO
    tax_total = ZERO

    for item in items:
        product = products[item["product_id"]]
        if not product.is_sellable:
            raise DomainError(
                f"El producto '{product.name}' no es vendible.", code="product_not_sellable"
            )

        qty = q(item["quantity"])
        if qty <= ZERO:
            raise DomainError("La cantidad debe ser mayor a cero.", code="invalid_quantity")

        unit_price = money(item.get("unit_price") or product.sale_price)
        discount = money(item.get("discount_amount") or ZERO)
        line_total = money((unit_price * qty) - discount)
        if line_total < ZERO:
            raise DomainError("El descuento supera el importe del renglón.", code="invalid_discount")

        tax_rate = product.tax_rate or ZERO
        tax_amount = money(line_total - (line_total / (Decimal(1) + tax_rate))) if tax_rate else ZERO

        order_item = OrderItem.objects.create(
            order=order,
            product=product,
            description=product.name,
            quantity=qty,
            unit_price=unit_price,
            discount_amount=discount,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            line_total=line_total,
            created_by=actor,
        )

        register_exit(
            product=product,
            warehouse=warehouse,
            quantity=qty,
            actor=actor,
            movement_type=MovementType.SALE,
            reason=f"Orden {order.code} - folio {folio.code}",
            source_document=order_item,
        )

        subtotal += line_total
        tax_total += tax_amount

    order.subtotal = money(subtotal)
    order.tax_total = money(tax_total)
    order.total = money(subtotal)
    order.save(update_fields=["subtotal", "tax_total", "total", "updated_at"])

    add_charge(
        folio=folio,
        charge_type=ChargeType.PRODUCTS,
        description=f"Consumo {order.get_order_type_display()} - orden {order.code}",
        unit_price=order.total,
        tax_amount=order.tax_total,
        actor=actor,
        order=order,
    )
    signals.order_created.send(sender=Order, order=order, actor=actor)
    return order


@transaction.atomic
def cancel_order_item(*, item_id: int, reason: str, actor) -> OrderItem:
    """Cancela un renglón, devuelve su inventario y ajusta el cargo del folio."""
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    item = (
        OrderItem.objects.select_for_update()
        .select_related("order", "order__folio", "product")
        .get(pk=item_id, is_active=True)
    )
    order = item.order
    folio = lock_folio(order.folio_id)

    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio ya está cerrado.", code="folio_not_open")
    if order.status == OrderStatus.CANCELLED:
        raise DomainError("La orden ya estaba cancelada.", code="order_already_cancelled")

    reverse_movements(
        movements_for(item),
        actor=actor,
        reason=f"Cancelacion de renglon: {reason}"[:255],
    )

    item.cancelled_at = timezone.now()
    item.cancellation_reason = reason[:255]
    item.is_active = False
    item.deleted_at = timezone.now()
    item.deleted_by = actor
    item.deletion_reason = reason[:255]
    item.save(
        update_fields=[
            "cancelled_at",
            "cancellation_reason",
            "is_active",
            "deleted_at",
            "deleted_by",
            "deletion_reason",
            "updated_at",
        ]
    )

    _refresh_order_totals(order, actor=actor)
    recalculate_folio(folio)
    return item


@transaction.atomic
def cancel_order(*, order_id: int, reason: str, actor, _skip_charge: bool = False) -> Order:
    """Cancela la orden completa: revierte inventario y anula el cargo."""
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    order = (
        Order.objects.select_for_update().select_related("folio").get(pk=order_id, is_active=True)
    )
    if order.status == OrderStatus.CANCELLED:
        raise DomainError("La orden ya estaba cancelada.", code="order_already_cancelled")

    folio = lock_folio(order.folio_id)
    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio ya está cerrado.", code="folio_not_open")

    for item in order.items.select_related("product").filter(is_active=True):
        reverse_movements(
            movements_for(item), actor=actor, reason=f"Cancelacion de orden: {reason}"[:255]
        )
        item.cancelled_at = timezone.now()
        item.cancellation_reason = reason[:255]
        item.is_active = False
        item.deleted_at = timezone.now()
        item.deleted_by = actor
        item.deletion_reason = reason[:255]
        item.save(
            update_fields=[
                "cancelled_at",
                "cancellation_reason",
                "is_active",
                "deleted_at",
                "deleted_by",
                "deletion_reason",
                "updated_at",
            ]
        )

    order.status = OrderStatus.CANCELLED
    order.cancelled_at = timezone.now()
    order.cancellation_reason = reason[:255]
    order.subtotal = ZERO
    order.tax_total = ZERO
    order.total = ZERO
    order.save(
        update_fields=[
            "status",
            "cancelled_at",
            "cancellation_reason",
            "subtotal",
            "tax_total",
            "total",
            "updated_at",
        ]
    )

    if not _skip_charge:
        charge = folio.charges.filter(order=order, cancelled_at__isnull=True).first()
        if charge is not None:
            charge.cancelled_at = timezone.now()
            charge.cancelled_by = actor
            charge.cancellation_reason = reason[:255]
            charge.is_active = False
            charge.deleted_at = timezone.now()
            charge.deleted_by = actor
            charge.deletion_reason = reason[:255]
            charge.save(
                update_fields=[
                    "cancelled_at",
                    "cancelled_by",
                    "cancellation_reason",
                    "is_active",
                    "deleted_at",
                    "deleted_by",
                    "deletion_reason",
                    "updated_at",
                ]
            )
        recalculate_folio(folio)

    signals.order_cancelled.send(sender=Order, order=order, reason=reason, actor=actor)
    return order


def _refresh_order_totals(order: Order, *, actor) -> Order:
    """Recalcula la orden tras cancelar renglones y sincroniza su cargo."""
    active_items = order.items.filter(is_active=True)
    subtotal = active_items.aggregate(total=Sum("line_total"))["total"] or ZERO
    taxes = active_items.aggregate(total=Sum("tax_amount"))["total"] or ZERO

    order.subtotal = money(subtotal)
    order.tax_total = money(taxes)
    order.total = money(subtotal)
    if not active_items.exists():
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = timezone.now()
    order.save(
        update_fields=["subtotal", "tax_total", "total", "status", "cancelled_at", "updated_at"]
    )

    charge = order.charges.filter(cancelled_at__isnull=True, is_active=True).first()
    if charge is not None:
        charge.unit_price = order.total
        charge.amount = order.total
        charge.tax_amount = order.tax_total
        charge.updated_by = actor
        charge.save(update_fields=["unit_price", "amount", "tax_amount", "updated_by", "updated_at"])
    return order


@transaction.atomic
def mark_order_delivered(*, order_id: int, actor) -> Order:
    order = Order.objects.select_for_update().get(pk=order_id, is_active=True)
    if order.status == OrderStatus.CANCELLED:
        raise DomainError("La orden esta cancelada.", code="order_cancelled")
    order.status = OrderStatus.DELIVERED
    order.delivered_at = timezone.now()
    order.delivered_by = actor
    order.save(update_fields=["status", "delivered_at", "delivered_by", "updated_at"])
    signals.order_delivered.send(sender=Order, order=order, actor=actor)
    return order


@transaction.atomic
def register_payment(
    *,
    folio_id: int,
    method: str,
    amount: Decimal,
    actor,
    tendered_amount: Decimal | None = None,
    reference: str = "",
) -> Payment:
    """Aplica un pago al folio validando que no exceda el saldo.

    Exige turno de caja abierto: todo cobro pertenece a un corte. El import
    es local para no acoplar ventas con finanzas a nivel de modulo.
    """
    from apps.finances.services import require_open_shift

    shift = require_open_shift(actor)
    folio = lock_folio(folio_id)
    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio no está abierto.", code="folio_not_open")

    value = money(amount)
    if value <= ZERO:
        raise DomainError("El importe del pago debe ser mayor a cero.", code="invalid_amount")

    recalculate_folio(folio)
    if value > folio.balance:
        raise DomainError(
            "El pago excede el saldo de la cuenta.",
            code="payment_exceeds_balance",
            balance=str(folio.balance),
            amount=str(value),
        )

    tendered = money(tendered_amount) if tendered_amount is not None else value
    change = ZERO
    if method == PaymentMethod.CASH:
        if tendered < value:
            raise DomainError(
                "El efectivo recibido es menor al importe del pago.", code="insufficient_cash"
            )
        change = money(tendered - value)
    else:
        tendered = value

    payment = Payment.objects.create(
        folio=folio,
        shift=shift,
        method=method,
        amount=value,
        tendered_amount=tendered,
        change_amount=change,
        reference=reference[:60],
        received_by=actor,
        paid_at=timezone.now(),
        created_by=actor,
    )
    recalculate_folio(folio)
    signals.payment_registered.send(
        sender=Payment, folio=folio, payment=payment, actor=actor
    )
    return payment


@transaction.atomic
def void_payment(*, payment_id: int, reason: str, actor) -> Payment:
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    payment = Payment.objects.select_for_update().select_related("folio").get(pk=payment_id)
    folio = lock_folio(payment.folio_id)

    if payment.status == PaymentStatus.VOIDED:
        raise DomainError("El pago ya estaba cancelado.", code="payment_already_voided")
    if folio.status == FolioStatus.CLOSED:
        raise DomainError(
            "No se puede cancelar un pago de un folio cerrado.", code="folio_closed"
        )

    payment.status = PaymentStatus.VOIDED
    payment.voided_at = timezone.now()
    payment.voided_by = actor
    payment.void_reason = reason[:255]
    payment.save(update_fields=["status", "voided_at", "voided_by", "void_reason", "updated_at"])

    recalculate_folio(folio)
    return payment


@transaction.atomic
def close_folio(*, folio_id: int, actor) -> Folio:
    """Cierra la cuenta. Exige saldo cero: no se cierra nada a crédito."""
    folio = lock_folio(folio_id)
    if folio.status != FolioStatus.OPEN:
        raise DomainError("El folio ya no está abierto.", code="folio_not_open")

    recalculate_folio(folio)
    if folio.balance > ZERO:
        raise DomainError(
            "La cuenta tiene saldo pendiente.",
            code="folio_has_balance",
            balance=str(folio.balance),
        )
    if folio.balance < ZERO:
        raise DomainError(
            "Los pagos superan el total de la cuenta.",
            code="folio_overpaid",
            balance=str(folio.balance),
        )

    open_orders = folio.orders.filter(
        is_active=True, status__in=[OrderStatus.DRAFT, OrderStatus.PLACED, OrderStatus.PREPARING]
    )
    if open_orders.exists():
        raise DomainError(
            "Hay ordenes sin entregar en la cuenta.",
            code="pending_orders",
            orders=list(open_orders.values_list("code", flat=True)),
        )

    folio.status = FolioStatus.CLOSED
    folio.closed_at = timezone.now()
    folio.closed_by = actor
    folio.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
    signals.folio_closed.send(sender=Folio, folio=folio, actor=actor)
    return folio


@transaction.atomic
def cancel_folio(*, folio_id: int, reason: str, actor) -> Folio:
    """Cancela la cuenta completa revirtiendo consumos y pagos."""
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    folio = lock_folio(folio_id)
    if folio.status == FolioStatus.CLOSED:
        raise DomainError("No se puede cancelar un folio cerrado.", code="folio_closed")

    for order in folio.orders.filter(is_active=True).exclude(status=OrderStatus.CANCELLED):
        cancel_order(order_id=order.pk, reason=reason, actor=actor)

    for payment in folio.payments.filter(status=PaymentStatus.APPLIED, is_active=True):
        void_payment(payment_id=payment.pk, reason=reason, actor=actor)

    for charge in folio.charges.filter(is_active=True, cancelled_at__isnull=True):
        charge.cancelled_at = timezone.now()
        charge.cancelled_by = actor
        charge.cancellation_reason = reason[:255]
        charge.is_active = False
        charge.deleted_at = timezone.now()
        charge.deleted_by = actor
        charge.deletion_reason = reason[:255]
        charge.save(
            update_fields=[
                "cancelled_at",
                "cancelled_by",
                "cancellation_reason",
                "is_active",
                "deleted_at",
                "deleted_by",
                "deletion_reason",
                "updated_at",
            ]
        )

    folio.status = FolioStatus.CANCELLED
    folio.cancellation_reason = reason[:255]
    folio.closed_at = timezone.now()
    folio.closed_by = actor
    recalculate_folio(folio)
    folio.save(
        update_fields=["status", "cancellation_reason", "closed_at", "closed_by", "updated_at"]
    )
    return folio
