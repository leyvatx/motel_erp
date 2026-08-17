"""Catalogos y estados del modulo de habitaciones."""

from django.db import models


class RoomStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Disponible"
    RESERVED = "RESERVED", "Reservada"
    OCCUPIED = "OCCUPIED", "Ocupada"
    CLEANING = "CLEANING", "En limpieza"
    MAINTENANCE = "MAINTENANCE", "En mantenimiento"
    BLOCKED = "BLOCKED", "Fuera de servicio"


class StayStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Activa"
    CLOSED = "CLOSED", "Cerrada"
    CANCELLED = "CANCELLED", "Cancelada"


class ReservationStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    CONFIRMED = "CONFIRMED", "Confirmada"
    CHECKED_IN = "CHECKED_IN", "En casa"
    CANCELLED = "CANCELLED", "Cancelada"
    NO_SHOW = "NO_SHOW", "No se presento"
    EXPIRED = "EXPIRED", "Vencida"


class TariffRuleType(models.TextChoices):
    WEEKDAY = "WEEKDAY", "Días de la semana"
    DATE_RANGE = "DATE_RANGE", "Rango de fechas"
    HOLIDAY = "HOLIDAY", "Día festivo"


class PriceMode(models.TextChoices):
    FIXED = "FIXED", "Precio fijo"
    MULTIPLIER = "MULTIPLIER", "Multiplicador"
    DELTA = "DELTA", "Monto adicional"


#: Colores semanticos del grid de recepción (los mismos del frontend).
ROOM_STATUS_COLORS = {
    RoomStatus.AVAILABLE: "status-available",
    RoomStatus.RESERVED: "brand-accent",
    RoomStatus.OCCUPIED: "status-occupied",
    RoomStatus.CLEANING: "status-cleaning",
    RoomStatus.MAINTENANCE: "status-maintenance",
    RoomStatus.BLOCKED: "status-maintenance",
}

#: Estados en los que la habitación no puede rentarse.
NON_RENTABLE_STATUSES = frozenset(
    {RoomStatus.OCCUPIED, RoomStatus.CLEANING, RoomStatus.MAINTENANCE, RoomStatus.BLOCKED}
)
