"""Tareas asincronas de ventas.

Corre en la cola ``printing``, aparte de todo lo demás, porque una térmica
apagada bloquea el worker diez segundos por intento.

El reintento se decide leyendo el comprobante, no atrapando una excepción:
``print_receipt`` guarda el fallo en ``error_message`` y no relanza, de modo
que el ticket queda registrado y reimprimible aunque la impresora nunca
conteste. Antes el ``autoretry_for`` de esta tarea era letra muerta por eso
mismo: nada llegaba nunca a levantar.
"""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)

RETRY_COUNTDOWN_SECONDS = 60


@shared_task(
    bind=True,
    name="apps.sales.tasks.print_receipt",
    ignore_result=True,
    max_retries=3,
    soft_time_limit=45,
    time_limit=60,
)
def print_receipt_task(self, receipt_id: int, open_drawer: bool = False) -> None:
    """Imprime un comprobante ya persistido. Reintenta si la termica falla."""
    from apps.sales.models import Receipt
    from apps.sales.printing import PrinterError
    from apps.sales.receipts import print_receipt

    receipt = Receipt.objects.filter(pk=receipt_id).first()
    if receipt is None:
        logger.warning("El comprobante %s ya no existe.", receipt_id)
        return

    receipt = print_receipt(receipt, open_drawer=open_drawer)
    if receipt.error_message:
        raise self.retry(
            exc=PrinterError(receipt.error_message),
            countdown=RETRY_COUNTDOWN_SECONDS * (self.request.retries + 1),
        )
