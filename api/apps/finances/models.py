"""Turnos de caja, arqueos y gastos operativos.

El corte es ciego por diseño: el cajero declara lo que conto sin ver lo que el
sistema espera. ``expected_cash`` se calcula al cerrar y la diferencia queda
asentada; nadie puede "cuadrar" el turno editando cifras.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import BaseModel, ImmutableModel
from common.utils import ZERO

from apps.finances.constants import (
    CashCountKind,
    CashDirection,
    CashMovementReason,
    ExpenseCategory,
    ExpenseStatus,
    ShiftStatus,
    ShiftType,
)


class Shift(BaseModel):
    """Turno de caja de un cajero."""

    code = models.CharField("Folio de turno", max_length=25, editable=False)
    cashier = models.ForeignKey(
        "users.User",
        verbose_name="Cajero",
        on_delete=models.PROTECT,
        related_name="shifts",
    )
    shift_type = models.CharField(
        "Tipo", max_length=10, choices=ShiftType.choices, default=ShiftType.MORNING
    )
    status = models.CharField(
        "Estado", max_length=10, choices=ShiftStatus.choices, default=ShiftStatus.OPEN,
        db_index=True,
    )

    opened_at = models.DateTimeField("Apertura", default=timezone.now, db_index=True)
    closed_at = models.DateTimeField("Cierre", null=True, blank=True)
    business_date = models.DateField("Día de operación", db_index=True)

    opening_balance = models.DecimalField(
        "Fondo inicial", max_digits=12, decimal_places=2, default=ZERO,
        validators=[MinValueValidator(ZERO)],
    )

    cash_sales = models.DecimalField("Ventas en efectivo", max_digits=12, decimal_places=2, default=ZERO)
    card_sales = models.DecimalField("Ventas con tarjeta", max_digits=12, decimal_places=2, default=ZERO)
    transfer_sales = models.DecimalField("Transferencias", max_digits=12, decimal_places=2, default=ZERO)
    courtesy_total = models.DecimalField("Cortesias", max_digits=12, decimal_places=2, default=ZERO)
    cash_in_total = models.DecimalField("Entradas de efectivo", max_digits=12, decimal_places=2, default=ZERO)
    cash_out_total = models.DecimalField("Salidas de efectivo", max_digits=12, decimal_places=2, default=ZERO)
    expenses_total = models.DecimalField("Gastos aprobados", max_digits=12, decimal_places=2, default=ZERO)
    expected_cash = models.DecimalField("Efectivo esperado", max_digits=12, decimal_places=2, default=ZERO)

    declared_cash = models.DecimalField(
        "Efectivo declarado", max_digits=12, decimal_places=2, null=True, blank=True
    )
    difference = models.DecimalField(
        "Diferencia", max_digits=12, decimal_places=2, default=ZERO,
        help_text="Declarado menos esperado. Negativo = faltante.",
    )

    folios_closed = models.PositiveIntegerField("Folios cerrados", default=0)
    stays_closed = models.PositiveIntegerField("Rentas cerradas", default=0)

    closed_by = models.ForeignKey(
        "users.User",
        verbose_name="Cerrado por",
        on_delete=models.PROTECT,
        related_name="closed_shifts",
        null=True,
        blank=True,
    )
    verified_by = models.ForeignKey(
        "users.User",
        verbose_name="Verificado por",
        on_delete=models.PROTECT,
        related_name="verified_shifts",
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField("Verificado en", null=True, blank=True)
    notes = models.TextField("Observaciones", blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Turno de caja"
        verbose_name_plural = "Turnos de caja"
        ordering = ["-opened_at"]
        constraints = [
            models.UniqueConstraint(fields=["motel", "code"], name="uniq_shift_code_motel"),
            models.UniqueConstraint(
                fields=["cashier"],
                condition=models.Q(status=ShiftStatus.OPEN),
                name="uniq_open_shift_per_cashier",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-opened_at"], name="shift_status_opened_idx"),
            models.Index(fields=["business_date"], name="shift_business_date_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.cashier.full_name}"

    @property
    def is_open(self) -> bool:
        return self.status == ShiftStatus.OPEN

    @property
    def total_sales(self) -> Decimal:
        return self.cash_sales + self.card_sales + self.transfer_sales

    @property
    def has_difference(self) -> bool:
        return self.difference != ZERO


class CashCount(BaseModel):
    """Arqueo: desglose de denominaciones capturado por el cajero o gerencia."""

    shift = models.ForeignKey(
        Shift, verbose_name="Turno", on_delete=models.PROTECT, related_name="cash_counts"
    )
    kind = models.CharField("Tipo", max_length=10, choices=CashCountKind.choices)
    breakdown = models.JSONField(
        "Desglose",
        default=dict,
        help_text='Denominación a cantidad, p. ej. {"500": 3, "100": 12}.',
    )
    declared_total = models.DecimalField("Total declarado", max_digits=12, decimal_places=2)
    counted_by = models.ForeignKey(
        "users.User",
        verbose_name="Contado por",
        on_delete=models.PROTECT,
        related_name="cash_counts",
    )
    notes = models.CharField("Notas", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Arqueo de caja"
        verbose_name_plural = "Arqueos de caja"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shift", "kind"], name="cashcount_shift_kind_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} {self.shift.code}: {self.declared_total}"


class CashMovement(ImmutableModel):
    """Entrada o salida de efectivo del cajon que no proviene de una venta."""

    shift = models.ForeignKey(
        Shift, verbose_name="Turno", on_delete=models.PROTECT, related_name="cash_movements"
    )
    direction = models.CharField("Sentido", max_length=3, choices=CashDirection.choices)
    reason = models.CharField(
        "Concepto", max_length=15, choices=CashMovementReason.choices,
        default=CashMovementReason.OTHER,
    )
    amount = models.DecimalField(
        "Importe", max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField("Descripción", max_length=255, blank=True)
    reference = models.CharField("Referencia", max_length=60, blank=True)
    expense = models.OneToOneField(
        "finances.Expense",
        verbose_name="Gasto origen",
        on_delete=models.PROTECT,
        related_name="cash_movement",
        null=True,
        blank=True,
    )
    performed_by = models.ForeignKey(
        "users.User",
        verbose_name="Registrado por",
        on_delete=models.PROTECT,
        related_name="cash_movements",
    )

    class Meta:
        verbose_name = "Movimiento de efectivo"
        verbose_name_plural = "Movimientos de efectivo"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shift", "direction"], name="cashmov_shift_dir_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_direction_display()} {self.amount} ({self.shift.code})"

    @property
    def signed_amount(self) -> Decimal:
        return self.amount if self.direction == CashDirection.IN else -self.amount


class Expense(BaseModel):
    """Gasto operativo del turno.

    Arriba del umbral configurado nace PENDIENTE y no toca el efectivo hasta
    que gerencia lo aprueba.
    """

    folio = models.CharField("Folio", max_length=25, editable=False)
    shift = models.ForeignKey(
        Shift, verbose_name="Turno", on_delete=models.PROTECT, related_name="expenses"
    )
    category = models.CharField(
        "Categoría", max_length=12, choices=ExpenseCategory.choices,
        default=ExpenseCategory.OTHER,
    )
    description = models.CharField("Descripción", max_length=255)
    supplier = models.CharField("Proveedor", max_length=120, blank=True)
    amount = models.DecimalField(
        "Importe", max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    status = models.CharField(
        "Estado", max_length=10, choices=ExpenseStatus.choices, default=ExpenseStatus.APPROVED,
        db_index=True,
    )
    requires_approval = models.BooleanField("Requiere aprobación", default=False)
    receipt_reference = models.CharField("Comprobante", max_length=60, blank=True)

    requested_by = models.ForeignKey(
        "users.User",
        verbose_name="Solicitado por",
        on_delete=models.PROTECT,
        related_name="requested_expenses",
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        verbose_name="Revisado por",
        on_delete=models.PROTECT,
        related_name="reviewed_expenses",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField("Revisado en", null=True, blank=True)
    review_notes = models.CharField("Notas de revisión", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Gasto"
        verbose_name_plural = "Gastos"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["motel", "folio"], name="uniq_expense_folio_motel")
        ]
        indexes = [
            models.Index(fields=["shift", "status"], name="expense_shift_status_idx"),
            models.Index(fields=["status", "-created_at"], name="expense_status_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.folio} - {self.description} ({self.amount})"

    @property
    def affects_cash(self) -> bool:
        return self.status == ExpenseStatus.APPROVED
