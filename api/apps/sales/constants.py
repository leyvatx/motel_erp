"""Catalogos del modulo de ventas / cuenta abierta."""

from django.db import models


class FolioType(models.TextChoices):
    ROOM = "ROOM", "Cuenta de habitación"
    COUNTER = "COUNTER", "Venta de mostrador"


class FolioStatus(models.TextChoices):
    OPEN = "OPEN", "Abierta"
    CLOSED = "CLOSED", "Cerrada"
    CANCELLED = "CANCELLED", "Cancelada"


class ChargeType(models.TextChoices):
    ROOM_RENT = "ROOM_RENT", "Renta de habitación"
    EXTENSION = "EXTENSION", "Extensión de tiempo"
    OVERSTAY = "OVERSTAY", "Recargo por tiempo excedido"
    EXTRA_PERSON = "EXTRA_PERSON", "Persona adicional"
    PRODUCTS = "PRODUCTS", "Consumo de productos"
    SERVICE = "SERVICE", "Servicio"
    SURCHARGE = "SURCHARGE", "Recargo"
    DISCOUNT = "DISCOUNT", "Descuento"
    ADJUSTMENT = "ADJUSTMENT", "Ajuste"


class OrderType(models.TextChoices):
    ROOM_SERVICE = "ROOM_SERVICE", "Room service"
    MINIBAR = "MINIBAR", "Frigobar"
    SHOP = "SHOP", "Tienda / sex shop"
    COUNTER = "COUNTER", "Mostrador"


class OrderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    PLACED = "PLACED", "Solicitada"
    PREPARING = "PREPARING", "En preparación"
    DELIVERED = "DELIVERED", "Entregada"
    CANCELLED = "CANCELLED", "Cancelada"


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Efectivo"
    CARD = "CARD", "Tarjeta"
    TRANSFER = "TRANSFER", "Transferencia"
    COURTESY = "COURTESY", "Cortesia"


class PaymentStatus(models.TextChoices):
    APPLIED = "APPLIED", "Aplicado"
    VOIDED = "VOIDED", "Cancelado"


class ReceiptKind(models.TextChoices):
    ROOM_TICKET = "ROOM_TICKET", "Ticket de habitación"
    COUNTER_TICKET = "COUNTER_TICKET", "Ticket de mostrador"
    ORDER_TICKET = "ORDER_TICKET", "Comanda"
    SHIFT_REPORT = "SHIFT_REPORT", "Corte de turno"


NEGATIVE_CHARGE_TYPES = frozenset({ChargeType.DISCOUNT})

STOCK_COMMITTED_ORDER_STATUSES = frozenset(
    {OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.DELIVERED}
)
