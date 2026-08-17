"""Cuenta abierta (Folio), ordenes de consumo, pagos y tickets.

El Folio es el centro del cobro: la renta, sus extensiones, los recargos y
todos los consumos (room service, frigobar, tienda) cuelgan de el como
``FolioCharge``. Al cerrar, el total del folio es la suma de sus cargos y los
pagos deben cubrirlo exactamente.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import BaseModel
from common.utils import ZERO

from apps.sales.constants import (
    ChargeType,
    FolioStatus,
    FolioType,
    NEGATIVE_CHARGE_TYPES,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
    ReceiptKind,
)


class Folio(BaseModel):
    """Cuenta abierta asociada a una renta o a una venta de mostrador."""

    code = models.CharField("Folio", max_length=25, unique=True, editable=False)
    folio_type = models.CharField(
        "Tipo", max_length=10, choices=FolioType.choices, default=FolioType.ROOM
    )
    status = models.CharField(
        "Estado", max_length=10, choices=FolioStatus.choices, default=FolioStatus.OPEN,
        db_index=True,
    )
    stay = models.OneToOneField(
        "rooms.Stay",
        verbose_name="Renta",
        on_delete=models.PROTECT,
        related_name="folio",
        null=True,
        blank=True,
    )
    room = models.ForeignKey(
        "rooms.Room",
        verbose_name="Habitación",
        on_delete=models.PROTECT,
        related_name="folios",
        null=True,
        blank=True,
        help_text="Copia denormalizada para el buscador global y los reportes.",
    )

    opened_at = models.DateTimeField("Abierta en", default=timezone.now, db_index=True)
    closed_at = models.DateTimeField("Cerrada en", null=True, blank=True)
    closed_by = models.ForeignKey(
        "users.User",
        verbose_name="Cerrada por",
        on_delete=models.PROTECT,
        related_name="closed_folios",
        null=True,
        blank=True,
    )

    # Totales materializados: se recalculan en el service dentro de la
    # transacción que agrega o cancela cargos.
    subtotal = models.DecimalField("Subtotal", max_digits=12, decimal_places=2, default=ZERO)
    discount_total = models.DecimalField("Descuentos", max_digits=12, decimal_places=2, default=ZERO)
    tax_total = models.DecimalField("Impuestos", max_digits=12, decimal_places=2, default=ZERO)
    total = models.DecimalField("Total", max_digits=12, decimal_places=2, default=ZERO)
    paid_total = models.DecimalField("Pagado", max_digits=12, decimal_places=2, default=ZERO)

    notes = models.TextField("Notas", blank=True)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Folio"
        verbose_name_plural = "Folios"
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["status", "-opened_at"], name="folio_status_opened_idx"),
            models.Index(fields=["room", "status"], name="folio_room_status_idx"),
        ]

    def __str__(self) -> str:
        return self.code

    @property
    def balance(self) -> Decimal:
        return self.total - self.paid_total

    @property
    def is_settled(self) -> bool:
        return self.balance <= ZERO


class FolioCharge(BaseModel):
    """Renglón de cargo del folio.

    Todo lo cobrable termina aquí: la renta, cada extensión, el recargo por
    sobreestadia y cada orden de consumo.
    """

    folio = models.ForeignKey(
        Folio, verbose_name="Folio", on_delete=models.PROTECT, related_name="charges"
    )
    charge_type = models.CharField("Concepto", max_length=15, choices=ChargeType.choices)
    description = models.CharField("Descripción", max_length=180)
    quantity = models.DecimalField("Cantidad", max_digits=10, decimal_places=3, default=Decimal("1"))
    unit_price = models.DecimalField("Precio unitario", max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField("Impuesto", max_digits=12, decimal_places=2, default=ZERO)
    amount = models.DecimalField(
        "Importe",
        max_digits=12,
        decimal_places=2,
        help_text="Positivo para cargos, negativo para descuentos.",
    )

    order = models.ForeignKey(
        "sales.Order",
        verbose_name="Orden origen",
        on_delete=models.PROTECT,
        related_name="charges",
        null=True,
        blank=True,
    )
    stay_extension = models.OneToOneField(
        "rooms.StayExtension",
        verbose_name="Extensión origen",
        on_delete=models.PROTECT,
        related_name="charge",
        null=True,
        blank=True,
    )

    cancelled_at = models.DateTimeField("Cancelado en", null=True, blank=True)
    cancelled_by = models.ForeignKey(
        "users.User",
        verbose_name="Cancelado por",
        on_delete=models.PROTECT,
        related_name="cancelled_charges",
        null=True,
        blank=True,
    )
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Cargo del folio"
        verbose_name_plural = "Cargos del folio"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["folio", "is_active"], name="charge_folio_active_idx"),
            models.Index(fields=["charge_type"], name="charge_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.description}: {self.amount}"

    @property
    def is_negative(self) -> bool:
        return self.charge_type in NEGATIVE_CHARGE_TYPES


class Order(BaseModel):
    """Orden de consumo (room service, frigobar, tienda o mostrador)."""

    code = models.CharField("Número de orden", max_length=25, unique=True, editable=False)
    folio = models.ForeignKey(
        Folio, verbose_name="Folio", on_delete=models.PROTECT, related_name="orders"
    )
    order_type = models.CharField(
        "Tipo", max_length=15, choices=OrderType.choices, default=OrderType.ROOM_SERVICE
    )
    status = models.CharField(
        "Estado", max_length=12, choices=OrderStatus.choices, default=OrderStatus.PLACED,
        db_index=True,
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        verbose_name="Almacén de descarga",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    placed_at = models.DateTimeField("Solicitada en", default=timezone.now)
    delivered_at = models.DateTimeField("Entregada en", null=True, blank=True)
    delivered_by = models.ForeignKey(
        "users.User",
        verbose_name="Entregada por",
        on_delete=models.PROTECT,
        related_name="delivered_orders",
        null=True,
        blank=True,
    )
    subtotal = models.DecimalField("Subtotal", max_digits=12, decimal_places=2, default=ZERO)
    tax_total = models.DecimalField("Impuestos", max_digits=12, decimal_places=2, default=ZERO)
    total = models.DecimalField("Total", max_digits=12, decimal_places=2, default=ZERO)
    notes = models.TextField("Notas", blank=True)
    cancelled_at = models.DateTimeField("Cancelada en", null=True, blank=True)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Orden"
        verbose_name_plural = "Ordenes"
        ordering = ["-placed_at"]
        indexes = [
            models.Index(fields=["status", "-placed_at"], name="order_status_placed_idx"),
            models.Index(fields=["folio"], name="order_folio_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.get_order_type_display()})"


class OrderItem(BaseModel):
    """Renglón de una orden. Guarda snapshot de nombre y precio del producto."""

    order = models.ForeignKey(
        Order, verbose_name="Orden", on_delete=models.PROTECT, related_name="items"
    )
    product = models.ForeignKey(
        "inventory.Product",
        verbose_name="Producto",
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    description = models.CharField("Descripción", max_length=180)
    quantity = models.DecimalField(
        "Cantidad", max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))]
    )
    unit_price = models.DecimalField("Precio unitario", max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField("Descuento", max_digits=12, decimal_places=2, default=ZERO)
    tax_rate = models.DecimalField("Tasa de impuesto", max_digits=5, decimal_places=4, default=ZERO)
    tax_amount = models.DecimalField("Impuesto", max_digits=12, decimal_places=2, default=ZERO)
    line_total = models.DecimalField("Importe", max_digits=12, decimal_places=2)
    cancelled_at = models.DateTimeField("Cancelado en", null=True, blank=True)
    cancellation_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Renglón de orden"
        verbose_name_plural = "Renglones de orden"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["order", "is_active"], name="orderitem_order_idx"),
            models.Index(fields=["product"], name="orderitem_product_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.quantity} x {self.description}"


class Payment(BaseModel):
    """Pago aplicado a un folio, siempre dentro de un turno de caja abierto."""

    folio = models.ForeignKey(
        Folio, verbose_name="Folio", on_delete=models.PROTECT, related_name="payments"
    )
    shift = models.ForeignKey(
        "finances.Shift",
        verbose_name="Turno de caja",
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
        help_text="Turno en el que se cobró. Es la base del corte de caja.",
    )
    method = models.CharField("Método", max_length=10, choices=PaymentMethod.choices, db_index=True)
    status = models.CharField(
        "Estado", max_length=8, choices=PaymentStatus.choices, default=PaymentStatus.APPLIED
    )
    amount = models.DecimalField(
        "Importe", max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    tendered_amount = models.DecimalField(
        "Efectivo recibido", max_digits=12, decimal_places=2, default=ZERO
    )
    change_amount = models.DecimalField("Cambio", max_digits=12, decimal_places=2, default=ZERO)
    reference = models.CharField(
        "Referencia", max_length=60, blank=True, help_text="Autorización, últimos 4 digitos, folio."
    )
    received_by = models.ForeignKey(
        "users.User",
        verbose_name="Recibido por",
        on_delete=models.PROTECT,
        related_name="received_payments",
    )
    paid_at = models.DateTimeField("Pagado en", default=timezone.now, db_index=True)
    voided_at = models.DateTimeField("Cancelado en", null=True, blank=True)
    voided_by = models.ForeignKey(
        "users.User",
        verbose_name="Cancelado por",
        on_delete=models.PROTECT,
        related_name="voided_payments",
        null=True,
        blank=True,
    )
    void_reason = models.CharField("Motivo de cancelación", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"
        ordering = ["-paid_at"]
        indexes = [
            models.Index(fields=["folio", "status"], name="payment_folio_status_idx"),
            models.Index(fields=["method", "-paid_at"], name="payment_method_date_idx"),
            models.Index(fields=["shift", "status"], name="payment_shift_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="payment_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.get_method_display()} {self.amount} ({self.folio.code})"


class Receipt(BaseModel):
    """Comprobante impreso en la termica (ESC/POS). Guarda el snapshot enviado."""

    folio = models.ForeignKey(
        Folio, verbose_name="Folio", on_delete=models.PROTECT, related_name="receipts",
        null=True, blank=True,
    )
    order = models.ForeignKey(
        Order, verbose_name="Orden", on_delete=models.PROTECT, related_name="receipts",
        null=True, blank=True,
    )
    kind = models.CharField("Tipo", max_length=16, choices=ReceiptKind.choices)
    printer_name = models.CharField("Impresora", max_length=60, blank=True)
    payload = models.JSONField("Contenido impreso", default=dict)
    printed_at = models.DateTimeField("Impreso en", null=True, blank=True)
    printed_by = models.ForeignKey(
        "users.User",
        verbose_name="Impreso por",
        on_delete=models.PROTECT,
        related_name="printed_receipts",
        null=True,
        blank=True,
    )
    copies = models.PositiveSmallIntegerField("Copias", default=1)
    is_reprint = models.BooleanField("Es reimpresion", default=False)
    error_message = models.CharField("Error de impresión", max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Comprobante"
        verbose_name_plural = "Comprobantes"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["folio", "-created_at"], name="receipt_folio_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} - {self.folio or self.order}"
