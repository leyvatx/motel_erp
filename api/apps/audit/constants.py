"""Catalogos de la bitácora de auditoría."""

from django.db import models


class AuditAction(models.TextChoices):
    # Genericas (signals de modelo)
    CREATE = "CREATE", "Alta"
    UPDATE = "UPDATE", "Modificación"
    SOFT_DELETE = "SOFT_DELETE", "Baja lógica"
    RESTORE = "RESTORE", "Reactivación"
    # De negocio (signals de dominio)
    ROOM_RENTED = "ROOM_RENTED", "Renta de habitación"
    ROOM_EXTENDED = "ROOM_EXTENDED", "Extensión de renta"
    ROOM_CHECKOUT = "ROOM_CHECKOUT", "Cierre de renta"
    ROOM_CANCELLED = "ROOM_CANCELLED", "Cancelación de renta"
    ROOM_STATUS = "ROOM_STATUS", "Cambio de estado de habitación"
    ORDER_CREATED = "ORDER_CREATED", "Alta de consumo"
    ORDER_CANCELLED = "ORDER_CANCELLED", "Cancelación de consumo"
    PAYMENT_REGISTERED = "PAYMENT_REGISTERED", "Registro de pago"
    PAYMENT_VOIDED = "PAYMENT_VOIDED", "Cancelación de pago"
    FOLIO_CLOSED = "FOLIO_CLOSED", "Cierre de cuenta"
    SHIFT_OPENED = "SHIFT_OPENED", "Apertura de turno"
    SHIFT_CLOSED = "SHIFT_CLOSED", "Cierre de turno"
    EXPENSE_REVIEWED = "EXPENSE_REVIEWED", "Revisión de gasto"
    STOCK_MOVED = "STOCK_MOVED", "Movimiento de inventario"


class AuditModule(models.TextChoices):
    ROOMS = "ROOMS", "Recepción"
    SALES = "SALES", "Ventas"
    INVENTORY = "INVENTORY", "Inventario"
    HOUSEKEEPING = "HOUSEKEEPING", "Ama de llaves"
    FINANCES = "FINANCES", "Finanzas"
    USERS = "USERS", "Usuarios"
    CONFIG = "CONFIG", "Configuración"


#: Campos que jamás se copian a la bitácora.
SENSITIVE_FIELDS = frozenset(
    {"password", "last_login", "created_at", "updated_at", "user_permissions", "groups"}
)

#: Mapa app_label -> modulo de negocio para clasificar la bitácora.
APP_MODULE_MAP = {
    "rooms": AuditModule.ROOMS,
    "sales": AuditModule.SALES,
    "inventory": AuditModule.INVENTORY,
    "housekeeping": AuditModule.HOUSEKEEPING,
    "finances": AuditModule.FINANCES,
    "users": AuditModule.USERS,
}
