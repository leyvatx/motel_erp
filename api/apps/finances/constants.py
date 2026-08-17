"""Catalogos del modulo de finanzas y caja."""

from decimal import Decimal

from django.db import models


class ShiftStatus(models.TextChoices):
    OPEN = "OPEN", "Abierto"
    CLOSED = "CLOSED", "Cerrado"
    VERIFIED = "VERIFIED", "Verificado por gerencia"


class ShiftType(models.TextChoices):
    MORNING = "MORNING", "Matutino"
    EVENING = "EVENING", "Vespertino"
    NIGHT = "NIGHT", "Nocturno"
    SPECIAL = "SPECIAL", "Especial"


class CashCountKind(models.TextChoices):
    OPENING = "OPENING", "Fondo inicial"
    BLIND = "BLIND", "Corte ciego"
    DECLARED = "DECLARED", "Corte declarado"
    AUDIT = "AUDIT", "Arqueo de gerencia"


class CashDirection(models.TextChoices):
    IN = "IN", "Entrada"
    OUT = "OUT", "Salida"


class CashMovementReason(models.TextChoices):
    OPENING_FUND = "OPENING_FUND", "Fondo de caja"
    DROP = "DROP", "Retiro parcial a bóveda"
    REFILL = "REFILL", "Reposición de cambio"
    EXPENSE = "EXPENSE", "Gasto operativo"
    CORRECTION = "CORRECTION", "Corrección"
    OTHER = "OTHER", "Otro"


class ExpenseCategory(models.TextChoices):
    SUPPLIES = "SUPPLIES", "Insumos"
    MAINTENANCE = "MAINTENANCE", "Mantenimiento"
    UTILITIES = "UTILITIES", "Servicios (luz, agua, gas)"
    PAYROLL = "PAYROLL", "Nomina y viaticos"
    CLEANING = "CLEANING", "Limpieza"
    TRANSPORT = "TRANSPORT", "Transporte"
    OTHER = "OTHER", "Otro"


class ExpenseStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente de aprobación"
    APPROVED = "APPROVED", "Aprobado"
    REJECTED = "REJECTED", "Rechazado"
    CANCELLED = "CANCELLED", "Cancelado"


CASH_DENOMINATIONS: tuple[Decimal, ...] = (
    Decimal("1000"),
    Decimal("500"),
    Decimal("200"),
    Decimal("100"),
    Decimal("50"),
    Decimal("20"),
    Decimal("10"),
    Decimal("5"),
    Decimal("2"),
    Decimal("1"),
    Decimal("0.50"),
)

CASH_DIFFERENCE_TOLERANCE = Decimal("1.00")
