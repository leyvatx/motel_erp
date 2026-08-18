"""Capa de servicios de caja: turnos, arqueos y gastos.

El corte es ciego: ``close_shift`` recibe lo que el cajero conto y hasta ese
momento calcula lo esperado. La diferencia queda escrita en el turno; nadie
la corrige editando el registro.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from common.exceptions import DomainError, ShiftRequiredError
from common.models import DocumentSequence
from common.utils import ZERO, business_date, money, period_key

from apps.finances import signals
from apps.finances.constants import (
    CASH_DENOMINATIONS,
    CashCountKind,
    CashDirection,
    CashMovementReason,
    ExpenseStatus,
    ShiftStatus,
    ShiftType,
)
from apps.finances.models import CashCount, CashMovement, Expense, Shift


def get_open_shift(user) -> Shift | None:
    """Turno abierto del usuario, o ``None`` si no tiene."""
    return Shift.objects.filter(cashier=user, status=ShiftStatus.OPEN, is_active=True).first()


def require_open_shift(user) -> Shift:
    shift = get_open_shift(user)
    if shift is None:
        raise ShiftRequiredError(
            detail=f"{user.get_short_name()} no tiene un turno de caja abierto.",
            user_id=user.pk,
        )
    return shift


def _validate_breakdown(breakdown: dict, declared_total: Decimal) -> Decimal:
    """Comprueba que el desglose de denominaciones cuadre con el total."""
    if not breakdown:
        return money(declared_total)

    total = ZERO
    validas = {str(d) for d in CASH_DENOMINATIONS}
    for denominacion, cantidad in breakdown.items():
        if str(denominacion) not in validas:
            raise DomainError(
                f"Denominacion no valida: {denominacion}.", code="invalid_denomination"
            )
        if int(cantidad) < 0:
            raise DomainError("Las cantidades no pueden ser negativas.", code="invalid_quantity")
        total += Decimal(str(denominacion)) * int(cantidad)

    total = money(total)
    if total != money(declared_total):
        raise DomainError(
            "El desglose de billetes no coincide con el total declarado.",
            code="breakdown_mismatch",
            breakdown_total=str(total),
            declared_total=str(money(declared_total)),
        )
    return total


@transaction.atomic
def open_shift(
    *,
    cashier,
    opening_balance: Decimal = ZERO,
    shift_type: str = ShiftType.MORNING,
    breakdown: dict | None = None,
    actor=None,
    notes: str = "",
) -> Shift:
    """Abre el turno con su fondo de caja."""
    if get_open_shift(cashier) is not None:
        raise DomainError(
            f"{cashier.get_short_name()} ya tiene un turno abierto.", code="shift_already_open"
        )
    if Decimal(opening_balance) < ZERO:
        raise DomainError("El fondo inicial no puede ser negativo.", code="invalid_opening_balance")

    actor = actor or cashier
    now = timezone.now()
    shift = Shift.objects.create(
        code=DocumentSequence.next_value("shift", "T", period_key(now)),
        cashier=cashier,
        shift_type=shift_type,
        opened_at=now,
        business_date=business_date(now),
        opening_balance=money(opening_balance),
        notes=notes,
        created_by=actor,
    )

    if opening_balance > ZERO:
        _validate_breakdown(breakdown or {}, opening_balance)
        CashCount.objects.create(
            shift=shift,
            kind=CashCountKind.OPENING,
            breakdown=breakdown or {},
            declared_total=money(opening_balance),
            counted_by=actor,
            created_by=actor,
        )
        CashMovement.objects.create(
            shift=shift,
            direction=CashDirection.IN,
            reason=CashMovementReason.OPENING_FUND,
            amount=money(opening_balance),
            description="Fondo de caja inicial",
            performed_by=actor,
        )

    _broadcast_shift(shift, "opened")
    signals.shift_opened.send(sender=Shift, shift=shift, actor=actor)
    return shift


def compute_shift_totals(shift: Shift) -> dict[str, Decimal | int]:
    """Suma ventas, movimientos y gastos del turno.

    Es la única fuente de las cifras del corte; el cajero nunca las captura.
    """
    from apps.sales.constants import FolioStatus, PaymentMethod, PaymentStatus
    from apps.sales.models import Folio, Payment

    pagos = Payment.objects.filter(
        shift=shift, is_active=True, status=PaymentStatus.APPLIED
    ).aggregate(
        cash=Sum("amount", filter=Q(method=PaymentMethod.CASH)),
        card=Sum("amount", filter=Q(method=PaymentMethod.CARD)),
        transfer=Sum("amount", filter=Q(method=PaymentMethod.TRANSFER)),
        courtesy=Sum("amount", filter=Q(method=PaymentMethod.COURTESY)),
    )

    movimientos = CashMovement.objects.filter(shift=shift).aggregate(
        entradas=Sum("amount", filter=Q(direction=CashDirection.IN)),
        salidas=Sum("amount", filter=Q(direction=CashDirection.OUT)),
    )

    gastos = (
        Expense.objects.filter(
            shift=shift, is_active=True, status=ExpenseStatus.APPROVED
        ).aggregate(total=Sum("amount"))["total"]
        or ZERO
    )

    folios = Folio.objects.filter(
        payments__shift=shift, status=FolioStatus.CLOSED, is_active=True
    ).aggregate(
        cerrados=Count("id", distinct=True),
        rentas=Count("stay", distinct=True, filter=Q(stay__isnull=False)),
    )

    cash_sales = money(pagos["cash"] or ZERO)
    cash_in = money(movimientos["entradas"] or ZERO)
    cash_out = money(movimientos["salidas"] or ZERO)

    return {
        "cash_sales": cash_sales,
        "card_sales": money(pagos["card"] or ZERO),
        "transfer_sales": money(pagos["transfer"] or ZERO),
        "courtesy_total": money(pagos["courtesy"] or ZERO),
        "cash_in_total": cash_in,
        "cash_out_total": cash_out,
        "expenses_total": money(gastos),
        "expected_cash": money(cash_sales + cash_in - cash_out),
        "folios_closed": folios["cerrados"] or 0,
        "stays_closed": folios["rentas"] or 0,
    }


@transaction.atomic
def close_shift(
    *,
    shift_id: int,
    declared_cash: Decimal,
    actor,
    breakdown: dict | None = None,
    notes: str = "",
) -> Shift:
    """Cierra el turno con corte ciego.

    El cajero entrega ``declared_cash``; el sistema calcula lo esperado y
    asienta la diferencia. Los gastos pendientes de aprobación bloquean el
    cierre: no se cierra un turno con dinero en el aire.
    """
    shift = Shift.objects.select_for_update().get(pk=shift_id, is_active=True)
    if shift.status != ShiftStatus.OPEN:
        raise DomainError("El turno ya está cerrado.", code="shift_not_open")

    pendientes = shift.expenses.filter(is_active=True, status=ExpenseStatus.PENDING)
    if pendientes.exists():
        raise DomainError(
            "Hay gastos pendientes de aprobación en el turno.",
            code="pending_expenses",
            expenses=list(pendientes.values_list("folio", flat=True)),
        )

    abiertos = _open_folios_of_shift(shift)
    if abiertos:
        raise DomainError(
            "Hay cuentas abiertas cobradas en este turno.",
            code="open_folios",
            folios=abiertos,
        )

    declarado = money(declared_cash)
    _validate_breakdown(breakdown or {}, declarado)

    totales = compute_shift_totals(shift)
    for campo, valor in totales.items():
        setattr(shift, campo, valor)

    shift.declared_cash = declarado
    shift.difference = money(declarado - shift.expected_cash)
    shift.status = ShiftStatus.CLOSED
    shift.closed_at = timezone.now()
    shift.closed_by = actor
    shift.notes = f"{shift.notes}\n{notes}".strip() if notes else shift.notes
    shift.updated_by = actor
    shift.save()

    CashCount.objects.create(
        shift=shift,
        kind=CashCountKind.BLIND,
        breakdown=breakdown or {},
        declared_total=declarado,
        counted_by=actor,
        notes=notes[:255],
        created_by=actor,
    )

    _broadcast_shift(shift, "closed")
    _notify_difference(shift)
    signals.shift_closed.send(sender=Shift, shift=shift, actor=actor)
    return shift


def _open_folios_of_shift(shift: Shift) -> list[str]:
    from apps.sales.constants import FolioStatus
    from apps.sales.models import Folio

    return list(
        Folio.objects.filter(payments__shift=shift, status=FolioStatus.OPEN, is_active=True)
        .distinct()
        .values_list("code", flat=True)
    )


@transaction.atomic
def verify_shift(
    *, shift_id: int, counted_cash: Decimal, actor, breakdown: dict | None = None, notes: str = ""
) -> Shift:
    """Arqueo de gerencia sobre un turno ya cerrado."""
    shift = Shift.objects.select_for_update().get(pk=shift_id, is_active=True)
    if shift.status != ShiftStatus.CLOSED:
        raise DomainError(
            "Solo se puede verificar un turno cerrado.", code="shift_not_closed"
        )

    contado = money(counted_cash)
    _validate_breakdown(breakdown or {}, contado)

    CashCount.objects.create(
        shift=shift,
        kind=CashCountKind.AUDIT,
        breakdown=breakdown or {},
        declared_total=contado,
        counted_by=actor,
        notes=notes[:255],
        created_by=actor,
    )

    shift.status = ShiftStatus.VERIFIED
    shift.verified_by = actor
    shift.verified_at = timezone.now()
    shift.updated_by = actor
    shift.save(update_fields=["status", "verified_by", "verified_at", "updated_by", "updated_at"])
    return shift


@transaction.atomic
def register_cash_movement(
    *,
    shift_id: int,
    direction: str,
    amount: Decimal,
    actor,
    reason: str = CashMovementReason.OTHER,
    description: str = "",
    reference: str = "",
    expense: Expense | None = None,
) -> CashMovement:
    """Entrada o salida de efectivo del cajon (retiro, reposición, gasto)."""
    shift = Shift.objects.select_for_update().get(pk=shift_id, is_active=True)
    if shift.status != ShiftStatus.OPEN:
        raise DomainError("El turno no está abierto.", code="shift_not_open")

    valor = money(amount)
    if valor <= ZERO:
        raise DomainError("El importe debe ser mayor a cero.", code="invalid_amount")

    if direction == CashDirection.OUT:
        disponible = compute_shift_totals(shift)["expected_cash"]
        if valor > disponible:
            raise DomainError(
                "No hay suficiente efectivo en caja para esta salida.",
                code="insufficient_cash_in_drawer",
                available=str(disponible),
                requested=str(valor),
            )

    return CashMovement.objects.create(
        shift=shift,
        direction=direction,
        reason=reason,
        amount=valor,
        description=description[:255],
        reference=reference[:60],
        expense=expense,
        performed_by=actor,
    )


def approval_threshold() -> Decimal:
    from apps.settings.models import Motel

    return Decimal(str(Motel.current().expense_approval_threshold))


@transaction.atomic
def register_expense(
    *,
    amount: Decimal,
    description: str,
    actor,
    shift_id: int | None = None,
    category: str = "",
    supplier: str = "",
    receipt_reference: str = "",
) -> Expense:
    """Registra un gasto del turno.

    Si supera el umbral configurado nace pendiente y no toca el efectivo
    hasta que gerencia lo aprueba.
    """
    from apps.finances.constants import ExpenseCategory

    shift = (
        Shift.objects.select_for_update().get(pk=shift_id, is_active=True)
        if shift_id
        else require_open_shift(actor)
    )
    if shift.status != ShiftStatus.OPEN:
        raise DomainError("El turno no está abierto.", code="shift_not_open")

    valor = money(amount)
    if valor <= ZERO:
        raise DomainError("El importe del gasto debe ser mayor a cero.", code="invalid_amount")

    requiere = valor > approval_threshold()
    expense = Expense.objects.create(
        folio=DocumentSequence.next_value("expense", "G", period_key()),
        shift=shift,
        category=category or ExpenseCategory.OTHER,
        description=description[:255],
        supplier=supplier[:120],
        amount=valor,
        status=ExpenseStatus.PENDING if requiere else ExpenseStatus.APPROVED,
        requires_approval=requiere,
        receipt_reference=receipt_reference[:60],
        requested_by=actor,
        created_by=actor,
    )

    if requiere:
        _notify_expense_approval(expense)
    else:
        register_cash_movement(
            shift_id=shift.pk,
            direction=CashDirection.OUT,
            amount=valor,
            reason=CashMovementReason.EXPENSE,
            description=f"Gasto {expense.folio}: {expense.description}",
            expense=expense,
            actor=actor,
        )
    return expense


@transaction.atomic
def review_expense(
    *, expense_id: int, approve: bool, actor, notes: str = ""
) -> Expense:
    """Aprueba o rechaza un gasto. Al aprobar se descuenta el efectivo."""
    expense = (
        Expense.objects.select_for_update(of=("self",))
        .select_related("shift")
        .get(pk=expense_id, is_active=True)
    )
    if expense.status != ExpenseStatus.PENDING:
        raise DomainError(
            "El gasto ya fue revisado.", code="expense_already_reviewed", status=expense.status
        )
    if not approve and not notes:
        raise DomainError("El rechazo requiere un motivo.", code="reason_required")

    expense.status = ExpenseStatus.APPROVED if approve else ExpenseStatus.REJECTED
    expense.reviewed_by = actor
    expense.reviewed_at = timezone.now()
    expense.review_notes = notes[:255]
    expense.updated_by = actor
    expense.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "review_notes", "updated_by", "updated_at"]
    )

    if approve:
        register_cash_movement(
            shift_id=expense.shift_id,
            direction=CashDirection.OUT,
            amount=expense.amount,
            reason=CashMovementReason.EXPENSE,
            description=f"Gasto {expense.folio}: {expense.description}",
            expense=expense,
            actor=actor,
        )

    signals.expense_reviewed.send(
        sender=Expense, expense=expense, approved=approve, actor=actor
    )
    return expense


def _broadcast_shift(shift: Shift, action: str) -> None:
    from apps.notifications.events import Event, broadcast, role_group
    from apps.users.constants import Role

    broadcast(
        Event.SHIFT_CHANGED,
        {
            "shift_id": shift.pk,
            "code": shift.code,
            "cashier": shift.cashier.full_name,
            "status": shift.status,
            "action": action,
        },
        motel=shift.motel_id,
        groups=[
            role_group(Role.MANAGER, shift.motel_id),
            role_group(Role.SUPERADMIN, shift.motel_id),
        ],
    )


def _notify_expense_approval(expense: Expense) -> None:
    from apps.notifications.models import NotificationCategory, NotificationLevel
    from apps.notifications.services import notify_management

    notify_management(
        category=NotificationCategory.EXPENSE_APPROVAL,
        level=NotificationLevel.WARNING,
        title=f"Gasto por aprobar: {expense.amount}",
        body=f"{expense.description} - solicitado por {expense.requested_by.full_name}",
        payload={
            "expense_id": expense.pk,
            "folio": expense.folio,
            "amount": str(expense.amount),
            "shift_code": expense.shift.code,
        },
        actor=expense.requested_by,
    )


def _notify_difference(shift: Shift) -> None:
    from apps.finances.constants import CASH_DIFFERENCE_TOLERANCE
    from apps.notifications.models import NotificationCategory, NotificationLevel
    from apps.notifications.services import notify_management

    if abs(shift.difference) <= CASH_DIFFERENCE_TOLERANCE:
        return

    faltante = shift.difference < ZERO
    notify_management(
        category=NotificationCategory.SHIFT,
        level=NotificationLevel.CRITICAL if faltante else NotificationLevel.WARNING,
        title=f"Corte con {'faltante' if faltante else 'sobrante'}: {shift.code}",
        body=(
            f"{shift.cashier.full_name} declaro {shift.declared_cash} "
            f"contra {shift.expected_cash} esperados."
        ),
        payload={
            "shift_id": shift.pk,
            "code": shift.code,
            "difference": str(shift.difference),
        },
    )
