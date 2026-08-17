"""Utilidades transversales: dinero, tiempo y folios."""

from __future__ import annotations

import zoneinfo
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

MONEY_QUANT = Decimal("0.01")
QTY_QUANT = Decimal("0.001")
ZERO = Decimal("0.00")


def business_tz() -> zoneinfo.ZoneInfo:
    """Zona horaria operativa del motel (solo para presentación y cortes).

    La importación va adentro de la función a proposito: ``common`` es la capa
    de abajo y no puede depender de ``apps`` al cargarse, o el arranque de
    Django entra en un ciclo. El perfil viene cacheado, así que llamar a esto
    en cada folio no cuesta una consulta.
    """
    from apps.settings.models import Motel

    return zoneinfo.ZoneInfo(Motel.current().time_zone)


def to_business_time(value: datetime) -> datetime:
    """Convierte un datetime UTC a la hora local del negocio."""
    return timezone.localtime(value, business_tz())


def business_date(value: datetime | None = None) -> date:
    """Fecha de operación (día local) de un instante UTC."""
    return to_business_time(value or timezone.now()).date()


def period_key(value: datetime | None = None) -> str:
    """Clave ``YYYYMMDD`` usada por los consecutivos diarios."""
    return business_date(value).strftime("%Y%m%d")


def money(value) -> Decimal:
    """Normaliza cualquier número a 2 decimales con redondeo comercial."""
    return Decimal(value).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def quantity(value) -> Decimal:
    """Normaliza cantidades de inventario a 3 decimales."""
    return Decimal(value).quantize(QTY_QUANT, rounding=ROUND_HALF_UP)


def add_minutes(moment: datetime, minutes: int) -> datetime:
    return moment + timedelta(minutes=minutes)


def minutes_between(start: datetime, end: datetime) -> int:
    return int((end - start).total_seconds() // 60)
