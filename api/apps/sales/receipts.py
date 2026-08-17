"""Emisión de comprobantes: arma, guarda e imprime.

El comprobante se persiste antes de intentar imprimirlo. Si la termica esta
apagada o sin papel, el ticket ya existe en la base y se reimprime desde la
interfaz sin volver a calcular importes.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.sales.constants import FolioType, ReceiptKind
from apps.sales.models import Folio, Receipt
from apps.sales.printing import (
    PrinterError,
    build_folio_payload,
    build_shift_payload,
    render_folio_ticket,
    render_shift_ticket,
    send_to_printer,
)

logger = logging.getLogger(__name__)


@transaction.atomic
def create_folio_receipt(*, folio: Folio, actor=None, is_reprint: bool = False) -> Receipt:
    kind = (
        ReceiptKind.ROOM_TICKET
        if folio.folio_type == FolioType.ROOM
        else ReceiptKind.COUNTER_TICKET
    )
    return Receipt.objects.create(
        folio=folio,
        kind=kind,
        payload=build_folio_payload(folio),
        printed_by=actor,
        is_reprint=is_reprint,
        created_by=actor,
    )


@transaction.atomic
def create_shift_receipt(*, shift, actor=None, is_reprint: bool = False) -> Receipt:
    return Receipt.objects.create(
        kind=ReceiptKind.SHIFT_REPORT,
        payload=build_shift_payload(shift),
        printed_by=actor,
        is_reprint=is_reprint,
        created_by=actor,
    )


def render(receipt: Receipt) -> str:
    """Texto plano del comprobante, tal como se manda a la termica."""
    if receipt.kind == ReceiptKind.SHIFT_REPORT:
        return render_shift_ticket(receipt.payload)
    return render_folio_ticket(receipt.payload)


def print_receipt(receipt: Receipt, *, open_drawer: bool = False) -> Receipt:
    """Envia el comprobante a la impresora y registra el resultado."""
    try:
        backend = send_to_printer(render(receipt), open_drawer=open_drawer)
        receipt.printed_at = timezone.now()
        receipt.printer_name = backend
        receipt.error_message = ""
    except PrinterError as exc:
        logger.warning("Fallo al imprimir el comprobante %s: %s", receipt.pk, exc)
        receipt.error_message = str(exc)[:255]

    receipt.save(update_fields=["printed_at", "printer_name", "error_message", "updated_at"])
    return receipt


def emit_folio_receipt(*, folio: Folio, actor=None, is_reprint: bool = False) -> Receipt:
    """Crea el comprobante y lo manda a la cola de impresión."""
    receipt = create_folio_receipt(folio=folio, actor=actor, is_reprint=is_reprint)
    _enqueue(receipt.pk, open_drawer=True)
    return receipt


def emit_shift_receipt(*, shift, actor=None, is_reprint: bool = False) -> Receipt:
    receipt = create_shift_receipt(shift=shift, actor=actor, is_reprint=is_reprint)
    _enqueue(receipt.pk)
    return receipt


def _enqueue(receipt_id: int, *, open_drawer: bool = False) -> None:
    """Encola la impresión; si el broker no responde, imprime en línea.

    Un ticket no se pierde porque Redis este caido.
    """

    def _dispatch() -> None:
        from apps.sales.tasks import print_receipt_task

        try:
            print_receipt_task.apply_async(args=[receipt_id, open_drawer], retry=False)
        except Exception:
            logger.warning("Broker no disponible; se imprime el ticket en línea.")
            print_receipt_task.run(receipt_id, open_drawer)

    transaction.on_commit(_dispatch)
