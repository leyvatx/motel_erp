"""Auditoría de las acciones de negocio.

El diferencial de campos que produce el registro genérico no cuenta la
historia completa: "status paso de ACTIVE a CLOSED" no dice cuánto se cobró
ni quien lo hizo. Estos receptores escriben el renglón legible.
"""

from __future__ import annotations

from django.dispatch import receiver

from apps.audit.constants import AuditAction, AuditModule
from apps.audit.services import record
from apps.finances import signals as finance_signals
from apps.inventory import signals as inventory_signals
from apps.rooms import signals as room_signals
from apps.sales import signals as sales_signals


@receiver(room_signals.stay_started, dispatch_uid="audit_stay_started")
def on_stay_started(sender, stay, actor=None, **kwargs):
    record(
        action=AuditAction.ROOM_RENTED,
        instance=stay,
        actor=actor,
        module=AuditModule.ROOMS,
        description=f"Renta {stay.code} en habitacion {stay.room.number}",
        extra={
            "room": stay.room.number,
            "tariff_block": stay.tariff_block.name,
            "base_price": str(stay.base_price),
            "expires_at": stay.expires_at.isoformat(),
            "vehicle_plate": stay.vehicle_plate,
        },
    )


@receiver(room_signals.stay_extended, dispatch_uid="audit_stay_extended")
def on_stay_extended(sender, stay, extension, actor=None, **kwargs):
    record(
        action=AuditAction.ROOM_EXTENDED,
        instance=stay,
        actor=actor,
        module=AuditModule.ROOMS,
        description=f"Extension de {extension.minutes} min en {stay.code}",
        changes={
            "expires_at": {
                "before": extension.previous_expires_at.isoformat(),
                "after": extension.new_expires_at.isoformat(),
            }
        },
        extra={"price": str(extension.price), "reason": extension.reason},
    )


@receiver(room_signals.stay_closed, dispatch_uid="audit_stay_closed")
def on_stay_closed(sender, stay, actor=None, **kwargs):
    folio = getattr(stay, "folio", None)
    record(
        action=AuditAction.ROOM_CHECKOUT,
        instance=stay,
        actor=actor,
        module=AuditModule.ROOMS,
        description=f"Cierre de renta {stay.code}",
        extra={
            "room": stay.room.number,
            "folio": folio.code if folio else None,
            "total": str(folio.total) if folio else None,
        },
    )


@receiver(room_signals.stay_cancelled, dispatch_uid="audit_stay_cancelled")
def on_stay_cancelled(sender, stay, reason="", actor=None, **kwargs):
    record(
        action=AuditAction.ROOM_CANCELLED,
        instance=stay,
        actor=actor,
        module=AuditModule.ROOMS,
        description=f"Cancelacion de renta {stay.code}",
        extra={"reason": reason, "room": stay.room.number},
    )


@receiver(room_signals.room_status_changed, dispatch_uid="audit_room_status")
def on_room_status_changed(sender, room, from_status, to_status, stay=None, actor=None, **kwargs):
    record(
        action=AuditAction.ROOM_STATUS,
        instance=room,
        actor=actor,
        module=AuditModule.ROOMS,
        description=f"Habitacion {room.number}: {from_status} -> {to_status}",
        changes={"status": {"before": from_status, "after": to_status}},
        extra={"stay": stay.code if stay else None, "reason": kwargs.get("reason", "")},
    )


@receiver(sales_signals.order_created, dispatch_uid="audit_order_created")
def on_order_created(sender, order, actor=None, **kwargs):
    """Un consumo sin destino no es auditable.

    Se registra a qué habitación y a qué renta se cargó, quién lo tomó y de
    qué almacén salió cada pieza: es la diferencia entre "se vendieron dos
    cervezas" y "el cuarto 203 pidió dos cervezas a las 23:40, las tomó Ana
    del bar y quedaron en su cuenta".
    """
    folio = order.folio
    stay = folio.stay

    record(
        action=AuditAction.ORDER_CREATED,
        instance=order,
        actor=actor,
        module=AuditModule.SALES,
        description=(
            f"Consumo {order.code} por {order.total} "
            + (f"cargado a la habitación {folio.room.number}" if folio.room_id else "en mostrador")
        ),
        extra={
            "folio": folio.code,
            "destination": order.order_type,
            "room": folio.room.number if folio.room_id else None,
            "stay": stay.code if stay else None,
            "guest": stay.guest_name if stay else "",
            "vehicle_plate": stay.vehicle_plate if stay else "",
            "warehouse": order.warehouse.name,
            "taken_by": getattr(actor, "username", None),
            "subtotal": str(order.subtotal),
            "tax_total": str(order.tax_total),
            "total": str(order.total),
            "items": [
                {
                    "sku": item.product.sku if item.product_id else None,
                    "product": item.description,
                    "quantity": str(item.quantity),
                    "unit_price": str(item.unit_price),
                    "line_total": str(item.line_total),
                }
                for item in order.items.select_related("product").all()
            ],
        },
    )


@receiver(sales_signals.order_cancelled, dispatch_uid="audit_order_cancelled")
def on_order_cancelled(sender, order, reason="", actor=None, **kwargs):
    record(
        action=AuditAction.ORDER_CANCELLED,
        instance=order,
        actor=actor,
        module=AuditModule.SALES,
        description=f"Cancelacion de consumo {order.code}",
        extra={"reason": reason, "folio": order.folio.code},
    )


@receiver(sales_signals.payment_registered, dispatch_uid="audit_payment_registered")
def on_payment_registered(sender, folio, payment, actor=None, **kwargs):
    record(
        action=AuditAction.PAYMENT_REGISTERED,
        instance=payment,
        actor=actor,
        module=AuditModule.SALES,
        description=f"Pago {payment.get_method_display()} de {payment.amount} en {folio.code}",
        extra={
            "folio": folio.code,
            "method": payment.method,
            "amount": str(payment.amount),
            "shift": payment.shift.code if payment.shift_id else None,
        },
    )


@receiver(sales_signals.folio_closed, dispatch_uid="audit_folio_closed")
def on_folio_closed(sender, folio, actor=None, **kwargs):
    record(
        action=AuditAction.FOLIO_CLOSED,
        instance=folio,
        actor=actor,
        module=AuditModule.SALES,
        description=f"Cierre de cuenta {folio.code} por {folio.total}",
        extra={
            "total": str(folio.total),
            "paid_total": str(folio.paid_total),
            "discount_total": str(folio.discount_total),
            "room": folio.room.number if folio.room_id else None,
        },
    )


@receiver(finance_signals.shift_opened, dispatch_uid="audit_shift_opened")
def on_shift_opened(sender, shift, actor=None, **kwargs):
    record(
        action=AuditAction.SHIFT_OPENED,
        instance=shift,
        actor=actor,
        module=AuditModule.FINANCES,
        description=f"Apertura de turno {shift.code} ({shift.cashier.full_name})",
        extra={"opening_balance": str(shift.opening_balance)},
    )


@receiver(finance_signals.shift_closed, dispatch_uid="audit_shift_closed")
def on_shift_closed(sender, shift, actor=None, **kwargs):
    record(
        action=AuditAction.SHIFT_CLOSED,
        instance=shift,
        actor=actor,
        module=AuditModule.FINANCES,
        description=f"Cierre de turno {shift.code} (diferencia {shift.difference})",
        extra={
            "expected_cash": str(shift.expected_cash),
            "declared_cash": str(shift.declared_cash),
            "difference": str(shift.difference),
            "cash_sales": str(shift.cash_sales),
            "card_sales": str(shift.card_sales),
            "transfer_sales": str(shift.transfer_sales),
        },
    )


@receiver(finance_signals.expense_reviewed, dispatch_uid="audit_expense_reviewed")
def on_expense_reviewed(sender, expense, approved, actor=None, **kwargs):
    record(
        action=AuditAction.EXPENSE_REVIEWED,
        instance=expense,
        actor=actor,
        module=AuditModule.FINANCES,
        description=(
            f"Gasto {expense.folio} {'aprobado' if approved else 'rechazado'}: {expense.amount}"
        ),
        extra={
            "amount": str(expense.amount),
            "approved": approved,
            "notes": expense.review_notes,
        },
    )


@receiver(inventory_signals.stock_movement_registered, dispatch_uid="audit_stock_movement")
def on_stock_movement(sender, movement, actor=None, **kwargs):
    record(
        action=AuditAction.STOCK_MOVED,
        instance=movement,
        actor=actor,
        module=AuditModule.INVENTORY,
        description=(
            f"{movement.get_movement_type_display()} {movement.signed_quantity} "
            f"de {movement.product.sku} en {movement.warehouse.code}"
        ),
        extra={
            "movement_type": movement.movement_type,
            "quantity": str(movement.signed_quantity),
            "balance_after": str(movement.balance_after),
            "reason": movement.reason,
        },
    )
