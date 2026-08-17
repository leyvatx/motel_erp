"""Catalogos del modulo de inventarios."""

from django.db import models


class WarehouseType(models.TextChoices):
    GENERAL = "GENERAL", "Almacén general"
    KITCHEN = "KITCHEN", "Cocina"
    BAR = "BAR", "Bar"
    HOUSEKEEPING = "HOUSEKEEPING", "Ama de llaves"
    MINIBAR = "MINIBAR", "Frigobar / habitaciones"
    SHOP = "SHOP", "Tienda"


class ProductKind(models.TextChoices):
    FOOD = "FOOD", "Alimentos"
    BEVERAGE = "BEVERAGE", "Bebidas"
    CLEANING = "CLEANING", "Artículos de limpieza"
    LINEN = "LINEN", "Blancos"
    AMENITY = "AMENITY", "Amenidades"
    SHOP = "SHOP", "Tienda / sex shop"
    OTHER = "OTHER", "Otros"


class UnitOfMeasure(models.TextChoices):
    PIECE = "PIECE", "Pieza"
    PACK = "PACK", "Paquete"
    BOX = "BOX", "Caja"
    LITER = "LITER", "Litro"
    MILLILITER = "MILLILITER", "Mililitro"
    KILOGRAM = "KILOGRAM", "Kilogramo"
    GRAM = "GRAM", "Gramo"
    SERVICE = "SERVICE", "Servicio"


class MovementType(models.TextChoices):
    PURCHASE = "PURCHASE", "Compra"
    RETURN_IN = "RETURN_IN", "Devolución de cliente"
    TRANSFER_IN = "TRANSFER_IN", "Traspaso recibido"
    ADJUSTMENT_IN = "ADJUSTMENT_IN", "Ajuste positivo"
    INITIAL = "INITIAL", "Inventario inicial"
    SALE = "SALE", "Venta"
    CONSUMPTION = "CONSUMPTION", "Consumo interno"
    WASTE = "WASTE", "Merma"
    EXPIRED = "EXPIRED", "Caducidad"
    TRANSFER_OUT = "TRANSFER_OUT", "Traspaso enviado"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Ajuste negativo"
    RETURN_OUT = "RETURN_OUT", "Devolución a proveedor"


MOVEMENT_SIGN: dict[str, int] = {
    MovementType.PURCHASE: 1,
    MovementType.RETURN_IN: 1,
    MovementType.TRANSFER_IN: 1,
    MovementType.ADJUSTMENT_IN: 1,
    MovementType.INITIAL: 1,
    MovementType.SALE: -1,
    MovementType.CONSUMPTION: -1,
    MovementType.WASTE: -1,
    MovementType.EXPIRED: -1,
    MovementType.TRANSFER_OUT: -1,
    MovementType.ADJUSTMENT_OUT: -1,
    MovementType.RETURN_OUT: -1,
}

INBOUND_MOVEMENTS = frozenset(k for k, v in MOVEMENT_SIGN.items() if v > 0)
OUTBOUND_MOVEMENTS = frozenset(k for k, v in MOVEMENT_SIGN.items() if v < 0)
