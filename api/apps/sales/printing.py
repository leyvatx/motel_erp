"""Impresión de tickets en termica ESC/POS.

El contenido del ticket se arma como un diccionario (``payload``) que se
guarda en ``Receipt``: si la impresora falla, el comprobante ya quedó
registrado y se puede reimprimir sin recalcular nada.

El backend de impresión se elige por configuración:
* ``dummy``   - no imprime (entornos de prueba y desarrollo).
* ``network`` - impresora por IP (lo habitual en recepción).
* ``usb``     - impresora conectada al equipo.
* ``file``    - escribe el ticket en un archivo (útil para depurar).
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.settings.models import Motel
from common.utils import ZERO, to_business_time

logger = logging.getLogger(__name__)

TICKET_WIDTH = 42


class PrinterError(Exception):
    """Falla de comunicacion con la impresora."""


def build_folio_payload(folio) -> dict[str, Any]:
    """Snapshot imprimible de la cuenta."""
    cargos = [
        {
            "description": cargo.description,
            "quantity": str(cargo.quantity),
            "unit_price": str(cargo.unit_price),
            "amount": str(cargo.amount),
        }
        for cargo in folio.charges.filter(is_active=True, cancelled_at__isnull=True).order_by(
            "created_at"
        )
    ]
    pagos = [
        {
            "method": pago.get_method_display(),
            "amount": str(pago.amount),
            "tendered": str(pago.tendered_amount),
            "change": str(pago.change_amount),
            "reference": pago.reference,
        }
        for pago in folio.payments.filter(is_active=True).order_by("paid_at")
    ]

    stay = folio.stay
    negocio = Motel.current()
    return {
        "business_name": negocio.name,
        "business_address": negocio.address,
        "folio_code": folio.code,
        "folio_type": folio.get_folio_type_display(),
        "room_number": folio.room.number if folio.room_id else None,
        "check_in_at": to_business_time(stay.check_in_at).isoformat() if stay else None,
        "checked_out_at": (
            to_business_time(stay.checked_out_at).isoformat()
            if stay and stay.checked_out_at
            else None
        ),
        "printed_at": to_business_time(timezone.now()).isoformat(),
        "charges": cargos,
        "subtotal": str(folio.subtotal),
        "discount_total": str(folio.discount_total),
        "tax_total": str(folio.tax_total),
        "total": str(folio.total),
        "paid_total": str(folio.paid_total),
        "payments": pagos,
        "currency": negocio.currency,
        "footer": negocio.ticket_footer,
    }


def build_shift_payload(shift) -> dict[str, Any]:
    """Snapshot imprimible del corte de turno."""
    return {
        "business_name": Motel.current().name,
        "shift_code": shift.code,
        "cashier": shift.cashier.full_name,
        "shift_type": shift.get_shift_type_display(),
        "opened_at": to_business_time(shift.opened_at).isoformat(),
        "closed_at": to_business_time(shift.closed_at).isoformat() if shift.closed_at else None,
        "opening_balance": str(shift.opening_balance),
        "cash_sales": str(shift.cash_sales),
        "card_sales": str(shift.card_sales),
        "transfer_sales": str(shift.transfer_sales),
        "cash_in_total": str(shift.cash_in_total),
        "cash_out_total": str(shift.cash_out_total),
        "expenses_total": str(shift.expenses_total),
        "expected_cash": str(shift.expected_cash),
        "declared_cash": str(shift.declared_cash) if shift.declared_cash is not None else None,
        "difference": str(shift.difference),
        "folios_closed": shift.folios_closed,
        "stays_closed": shift.stays_closed,
        "printed_at": to_business_time(timezone.now()).isoformat(),
    }


def _line(left: str, right: str, width: int = TICKET_WIDTH) -> str:
    espacio = max(width - len(left) - len(right), 1)
    return f"{left}{' ' * espacio}{right}"


def _center(text: str, width: int = TICKET_WIDTH) -> str:
    return text.center(width)


def _money(value: str | Decimal) -> str:
    return f"$ {Decimal(value):,.2f}"


def render_folio_ticket(payload: dict[str, Any]) -> str:
    lineas = [
        _center(payload["business_name"]),
    ]
    if payload.get("business_address"):
        lineas.append(_center(payload["business_address"]))
    lineas += [
        "-" * TICKET_WIDTH,
        _line("Folio:", payload["folio_code"]),
    ]
    if payload.get("room_number"):
        lineas.append(_line("Habitación:", str(payload["room_number"])))
    if payload.get("check_in_at"):
        lineas.append(_line("Entrada:", payload["check_in_at"][:16].replace("T", " ")))
    if payload.get("checked_out_at"):
        lineas.append(_line("Salida:", payload["checked_out_at"][:16].replace("T", " ")))

    lineas += ["-" * TICKET_WIDTH, "CONCEPTO", ""]
    for cargo in payload["charges"]:
        lineas.append(cargo["description"][:TICKET_WIDTH])
        lineas.append(
            _line(f"  {cargo['quantity']} x {_money(cargo['unit_price'])}", _money(cargo["amount"]))
        )

    lineas += ["-" * TICKET_WIDTH, _line("Subtotal", _money(payload["subtotal"]))]
    if Decimal(payload["discount_total"]) > ZERO:
        lineas.append(_line("Descuentos", f"-{_money(payload['discount_total'])}"))
    if Decimal(payload["tax_total"]) > ZERO:
        lineas.append(_line("IVA incluido", _money(payload["tax_total"])))
    lineas.append(_line("TOTAL", _money(payload["total"])))

    if payload["payments"]:
        lineas += ["", "PAGOS"]
        for pago in payload["payments"]:
            lineas.append(_line(pago["method"], _money(pago["amount"])))
            if Decimal(pago["change"]) > ZERO:
                lineas.append(_line("  Recibido", _money(pago["tendered"])))
                lineas.append(_line("  Cambio", _money(pago["change"])))

    lineas += [
        "-" * TICKET_WIDTH,
        _center(payload["printed_at"][:16].replace("T", " ")),
    ]
    if payload.get("footer"):
        lineas.append(_center(payload["footer"]))
    return "\n".join(lineas)


def render_shift_ticket(payload: dict[str, Any]) -> str:
    lineas = [
        _center(payload["business_name"]),
        _center("CORTE DE TURNO"),
        "-" * TICKET_WIDTH,
        _line("Turno:", payload["shift_code"]),
        _line("Cajero:", payload["cashier"]),
        _line("Apertura:", payload["opened_at"][:16].replace("T", " ")),
    ]
    if payload.get("closed_at"):
        lineas.append(_line("Cierre:", payload["closed_at"][:16].replace("T", " ")))

    lineas += [
        "-" * TICKET_WIDTH,
        _line("Fondo inicial", _money(payload["opening_balance"])),
        _line("Efectivo", _money(payload["cash_sales"])),
        _line("Tarjeta", _money(payload["card_sales"])),
        _line("Transferencia", _money(payload["transfer_sales"])),
        _line("Entradas", _money(payload["cash_in_total"])),
        _line("Salidas", f"-{_money(payload['cash_out_total'])}"),
        _line("Gastos", _money(payload["expenses_total"])),
        "-" * TICKET_WIDTH,
        _line("Efectivo esperado", _money(payload["expected_cash"])),
    ]
    if payload.get("declared_cash") is not None:
        lineas.append(_line("Efectivo declarado", _money(payload["declared_cash"])))
        lineas.append(_line("Diferencia", _money(payload["difference"])))

    lineas += [
        "-" * TICKET_WIDTH,
        _line("Folios cerrados", str(payload["folios_closed"])),
        _line("Rentas cerradas", str(payload["stays_closed"])),
        _center(payload["printed_at"][:16].replace("T", " ")),
    ]
    return "\n".join(lineas)


def send_to_printer(text: str, *, cut: bool = True, open_drawer: bool = False) -> str:
    """Manda el texto a la termica y devuelve el backend utilizado.

    Que impresora usar sale del perfil del negocio, no del entorno: cambiar la
    IP de la termica es una tarea de recepción, no un redespliegue. La ruta del
    archivo y los identificadores USB siguen en la configuración del servidor
    porque son propios del equipo donde corre el proceso.
    """
    negocio = Motel.current()
    backend = negocio.printer_backend

    if backend == "dummy":
        logger.info("Ticket (backend dummy):\n%s", text)
        return backend

    if backend == "file":
        ruta = settings.PRINTER_FILE_PATH
        with open(ruta, "a", encoding="utf-8") as archivo:
            archivo.write(f"{text}\n{'=' * TICKET_WIDTH}\n")
        return backend

    try:
        from escpos import printer as escpos_printer
    except ImportError as exc:
        raise PrinterError("python-escpos no está instalado.") from exc

    try:
        if backend == "network":
            device = escpos_printer.Network(
                negocio.printer_host, port=negocio.printer_port, timeout=10
            )
        elif backend == "usb":
            device = escpos_printer.Usb(
                int(settings.PRINTER_USB_VENDOR_ID, 16),
                int(settings.PRINTER_USB_PRODUCT_ID, 16),
            )
        else:
            raise PrinterError(f"Backend de impresion desconocido: {backend}")

        device.text(f"{text}\n")
        if open_drawer:
            device.cashdraw(2)
        if cut:
            device.cut()
        device.close()
    except PrinterError:
        raise
    except Exception as exc:
        raise PrinterError(str(exc)) from exc

    return backend
