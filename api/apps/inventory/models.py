"""Inventario multialmacen con Kardex inmutable.

Modelo de datos:
* ``WarehouseStock`` guarda el saldo vigente por producto/almacén. Es la fila
  que se bloquea con ``select_for_update`` al vender o descargar.
* ``StockLot`` maneja caducidades (PEPS por fecha de vencimiento).
* ``StockMovement`` es el Kardex: se escribe una vez y jamás se modifica.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import BaseModel, ImmutableModel, TenantModel
from common.utils import ZERO

from apps.inventory.constants import (
    MOVEMENT_SIGN,
    MovementType,
    ProductKind,
    UnitOfMeasure,
    WarehouseType,
    PurchaseStatus,
)


class Warehouse(BaseModel):
    """Almacén físico o lógico (general, cocina, bar, limpieza, frigobar)."""

    code = models.CharField("Clave", max_length=15)
    name = models.CharField("Nombre", max_length=80)
    warehouse_type = models.CharField(
        "Tipo", max_length=15, choices=WarehouseType.choices, default=WarehouseType.GENERAL
    )
    location = models.CharField("Ubicación", max_length=120, blank=True)
    is_default_for_sales = models.BooleanField(
        "Almacén de venta por defecto",
        default=False,
        help_text="Del que se descuenta el room service si no se indica otro.",
    )
    responsible = models.ForeignKey(
        "users.User",
        verbose_name="Responsable",
        on_delete=models.PROTECT,
        related_name="warehouses",
        null=True,
        blank=True,
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Almacén"
        verbose_name_plural = "Almacenes"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["motel", "code"],
                condition=models.Q(is_active=True),
                name="uniq_active_warehouse_code_motel",
            )
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class ProductCategory(BaseModel):
    """Agrupacion comercial dentro de una familia de productos."""

    name = models.CharField("Nombre", max_length=60)
    kind = models.CharField(
        "Familia", max_length=15, choices=ProductKind.choices, default=ProductKind.OTHER
    )
    description = models.CharField("Descripción", max_length=255, blank=True)
    sort_order = models.PositiveSmallIntegerField("Orden", default=0)

    class Meta(BaseModel.Meta):
        verbose_name = "Categoría de producto"
        verbose_name_plural = "Categorías de producto"
        ordering = ["kind", "sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["motel", "name", "kind"],
                condition=models.Q(is_active=True),
                name="uniq_active_product_category_motel",
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} / {self.name}"


class Product(BaseModel):
    """Artículo inventariable o servicio vendible."""

    sku = models.CharField("SKU", max_length=30, db_index=True)
    barcode = models.CharField("Código de barras", max_length=40, blank=True, db_index=True)
    name = models.CharField("Nombre", max_length=120, db_index=True)
    category = models.ForeignKey(
        ProductCategory,
        verbose_name="Categoría",
        on_delete=models.PROTECT,
        related_name="products",
    )
    unit = models.CharField(
        "Unidad", max_length=12, choices=UnitOfMeasure.choices, default=UnitOfMeasure.PIECE
    )
    is_sellable = models.BooleanField("Se vende al huesped", default=True)
    is_stockable = models.BooleanField(
        "Controla existencias",
        default=True,
        help_text="Los servicios (p. ej. lavanderia) no descuentan inventario.",
    )
    track_expiration = models.BooleanField("Controla caducidad", default=False)
    sale_price = models.DecimalField(
        "Precio de venta",
        max_digits=10,
        decimal_places=2,
        default=ZERO,
        validators=[MinValueValidator(ZERO)],
    )
    last_cost = models.DecimalField("Último costo", max_digits=10, decimal_places=4, default=ZERO)
    average_cost = models.DecimalField(
        "Costo promedio", max_digits=10, decimal_places=4, default=ZERO
    )
    tax_rate = models.DecimalField(
        "Tasa de impuesto", max_digits=5, decimal_places=4, default=ZERO,
        help_text="0.16 para IVA 16%.",
    )
    default_min_stock = models.DecimalField(
        "Stock mínimo sugerido", max_digits=12, decimal_places=3, default=ZERO
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["motel", "sku"],
                condition=models.Q(is_active=True),
                name="uniq_active_product_sku_motel",
            ),
            models.CheckConstraint(
                condition=models.Q(sale_price__gte=0), name="product_sale_price_non_negative"
            ),
        ]
        indexes = [
            models.Index(fields=["category", "is_active"], name="product_category_idx"),
            models.Index(fields=["is_sellable", "is_active"], name="product_sellable_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class Supplier(BaseModel):
    """Proveedor propio de cada motel."""

    code = models.CharField("Clave", max_length=20)
    business_name = models.CharField("Razón social", max_length=150, db_index=True)
    tax_id = models.CharField("RFC / identificación fiscal", max_length=30, blank=True)
    contact_name = models.CharField("Contacto", max_length=100, blank=True)
    phone = models.CharField("Teléfono", max_length=30, blank=True)
    email = models.EmailField("Correo", blank=True)
    address = models.CharField("Dirección", max_length=255, blank=True)
    payment_terms_days = models.PositiveSmallIntegerField("Días de crédito", default=0)
    notes = models.TextField("Notas", blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"
        ordering = ["business_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["motel", "code"],
                condition=models.Q(is_active=True),
                name="uniq_active_supplier_code_motel",
            )
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.business_name}"


class PurchaseOrder(BaseModel):
    """Orden de compra con recepciones parciales ligadas al Kardex."""

    folio = models.CharField("Folio", max_length=30, db_index=True, editable=False)
    supplier = models.ForeignKey(
        Supplier, verbose_name="Proveedor", on_delete=models.PROTECT, related_name="purchase_orders"
    )
    warehouse = models.ForeignKey(
        Warehouse, verbose_name="Almacén destino", on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    status = models.CharField(
        "Estado", max_length=12, choices=PurchaseStatus.choices, default=PurchaseStatus.DRAFT,
        db_index=True,
    )
    order_date = models.DateField("Fecha de orden", default=timezone.localdate)
    expected_date = models.DateField("Entrega esperada", null=True, blank=True)
    supplier_reference = models.CharField("Referencia del proveedor", max_length=60, blank=True)
    notes = models.TextField("Notas", blank=True)
    subtotal = models.DecimalField("Subtotal", max_digits=14, decimal_places=2, default=ZERO)
    tax_total = models.DecimalField("Impuestos", max_digits=14, decimal_places=2, default=ZERO)
    total = models.DecimalField("Total", max_digits=14, decimal_places=2, default=ZERO)
    received_at = models.DateTimeField("Recepción completa", null=True, blank=True, editable=False)

    class Meta(BaseModel.Meta):
        verbose_name = "Orden de compra"
        verbose_name_plural = "Órdenes de compra"
        ordering = ["-order_date", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["motel", "folio"], name="uniq_purchase_folio_motel")
        ]
        indexes = [models.Index(fields=["status", "-order_date"], name="purchase_status_date_idx")]

    def __str__(self) -> str:
        return self.folio


class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_items")
    quantity = models.DecimalField(
        "Cantidad solicitada", max_digits=14, decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    received_quantity = models.DecimalField(
        "Cantidad recibida", max_digits=14, decimal_places=3, default=ZERO, editable=False,
    )
    unit_cost = models.DecimalField(
        "Costo unitario", max_digits=10, decimal_places=4,
        validators=[MinValueValidator(ZERO)],
    )
    tax_rate = models.DecimalField("Tasa de impuesto", max_digits=5, decimal_places=4, default=ZERO)

    class Meta:
        verbose_name = "Partida de compra"
        verbose_name_plural = "Partidas de compra"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["order", "product"], name="uniq_purchase_product"),
            models.CheckConstraint(
                condition=models.Q(received_quantity__gte=0), name="purchase_received_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(received_quantity__lte=models.F("quantity")),
                name="purchase_received_not_exceeded",
            ),
        ]

    @property
    def pending_quantity(self):
        return self.quantity - self.received_quantity

    @property
    def line_subtotal(self):
        return self.quantity * self.unit_cost

    @property
    def line_total(self):
        return self.line_subtotal * (1 + self.tax_rate)


class WarehouseStock(TenantModel):
    """Saldo vigente de un producto en un almacén.

    No se borra ni se versiona: es el estado actual. El histórico esta en el
    Kardex (``StockMovement``).
    """

    product = models.ForeignKey(
        Product, verbose_name="Producto", on_delete=models.PROTECT, related_name="stocks"
    )
    warehouse = models.ForeignKey(
        Warehouse, verbose_name="Almacén", on_delete=models.PROTECT, related_name="stocks"
    )
    quantity = models.DecimalField("Existencia", max_digits=14, decimal_places=3, default=ZERO)
    reserved_quantity = models.DecimalField(
        "Comprometido", max_digits=14, decimal_places=3, default=ZERO
    )
    min_stock = models.DecimalField("Stock mínimo", max_digits=12, decimal_places=3, default=ZERO)
    max_stock = models.DecimalField("Stock máximo", max_digits=12, decimal_places=3, default=ZERO)
    low_stock_notified_at = models.DateTimeField(
        "Última alerta de stock", null=True, blank=True, editable=False
    )
    updated_at = models.DateTimeField("Actualizado en", auto_now=True)

    class Meta:
        verbose_name = "Existencia"
        verbose_name_plural = "Existencias"
        ordering = ["warehouse", "product"]
        constraints = [
            models.UniqueConstraint(
                fields=["product", "warehouse"], name="uniq_stock_product_warehouse"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0), name="stock_quantity_non_negative"
            ),
        ]
        indexes = [
            models.Index(fields=["warehouse", "product"], name="stock_warehouse_product_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.warehouse.code}: {self.quantity}"

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity

    @property
    def is_below_minimum(self) -> bool:
        return self.min_stock > 0 and self.quantity <= self.min_stock


class StockLot(BaseModel):
    """Lote con caducidad. Las salidas consumen primero el que vence antes."""

    product = models.ForeignKey(
        Product, verbose_name="Producto", on_delete=models.PROTECT, related_name="lots"
    )
    warehouse = models.ForeignKey(
        Warehouse, verbose_name="Almacén", on_delete=models.PROTECT, related_name="lots"
    )
    lot_code = models.CharField("Lote", max_length=40, blank=True)
    expiration_date = models.DateField("Caducidad", null=True, blank=True, db_index=True)
    quantity = models.DecimalField("Existencia del lote", max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField("Costo unitario", max_digits=10, decimal_places=4, default=ZERO)
    received_at = models.DateTimeField("Recibido en", default=timezone.now)
    expiry_notified_at = models.DateTimeField(
        "Alerta de caducidad enviada", null=True, blank=True, editable=False
    )

    class Meta(BaseModel.Meta):
        verbose_name = "Lote"
        verbose_name_plural = "Lotes"
        ordering = ["expiration_date", "received_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0), name="lot_quantity_non_negative"
            ),
        ]
        indexes = [
            models.Index(
                fields=["product", "warehouse", "expiration_date"], name="lot_fefo_idx"
            ),
        ]

    def __str__(self) -> str:
        vence = self.expiration_date.isoformat() if self.expiration_date else "sin caducidad"
        return f"{self.product.sku} lote {self.lot_code or self.pk} ({vence})"

    @property
    def is_expired(self) -> bool:
        return bool(self.expiration_date and self.expiration_date < timezone.localdate())


class StockMovement(ImmutableModel):
    """Kardex: renglón inmutable de entrada o salida.

    ``balance_after`` se calcula dentro de la transacción que bloquea el
    ``WarehouseStock``, de modo que la secuencia sea auditable y consistente.
    """

    product = models.ForeignKey(
        Product, verbose_name="Producto", on_delete=models.PROTECT, related_name="movements"
    )
    warehouse = models.ForeignKey(
        Warehouse, verbose_name="Almacén", on_delete=models.PROTECT, related_name="movements"
    )
    lot = models.ForeignKey(
        StockLot,
        verbose_name="Lote",
        on_delete=models.PROTECT,
        related_name="movements",
        null=True,
        blank=True,
    )
    movement_type = models.CharField(
        "Tipo de movimiento", max_length=15, choices=MovementType.choices, db_index=True
    )
    quantity = models.DecimalField(
        "Cantidad",
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
        help_text="Siempre positiva; el signo lo determina el tipo de movimiento.",
    )
    signed_quantity = models.DecimalField(
        "Cantidad con signo", max_digits=14, decimal_places=3, editable=False
    )
    balance_after = models.DecimalField(
        "Saldo posterior", max_digits=14, decimal_places=3, editable=False
    )
    unit_cost = models.DecimalField("Costo unitario", max_digits=10, decimal_places=4, default=ZERO)
    total_cost = models.DecimalField("Costo total", max_digits=14, decimal_places=4, default=ZERO)
    reason = models.CharField("Motivo", max_length=255, blank=True)
    performed_by = models.ForeignKey(
        "users.User",
        verbose_name="Realizado por",
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    content_type = models.ForeignKey(
        ContentType, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    object_id = models.PositiveBigIntegerField(null=True, blank=True)
    source_document = GenericForeignKey("content_type", "object_id")
    reversal_of = models.OneToOneField(
        "self",
        verbose_name="Reversa de",
        on_delete=models.PROTECT,
        related_name="reversal",
        null=True,
        blank=True,
        help_text="Un movimiento nunca se borra: se cancela con otro en sentido contrario.",
    )

    class Meta:
        verbose_name = "Movimiento de inventario"
        verbose_name_plural = "Kardex"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["product", "warehouse", "-created_at"], name="kardex_product_wh_idx"
            ),
            models.Index(fields=["movement_type", "-created_at"], name="kardex_type_idx"),
            models.Index(fields=["content_type", "object_id"], name="kardex_source_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} {self.signed_quantity} {self.product.sku}"

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.signed_quantity = self.quantity * MOVEMENT_SIGN[self.movement_type]
            self.total_cost = (self.unit_cost or ZERO) * self.quantity
        return super().save(*args, **kwargs)

    @property
    def is_inbound(self) -> bool:
        return MOVEMENT_SIGN[self.movement_type] > 0
