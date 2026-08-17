"""Tareas asincronas de ventas."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="apps.sales.tasks.print_receipt",
    ignore_result=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def print_receipt_task(receipt_id: int, open_drawer: bool = False) -> None:
    """Imprime un comprobante ya persistido. Reintenta si la termica falla."""
    from apps.sales.models import Receipt
    from apps.sales.receipts import print_receipt

    receipt = Receipt.objects.filter(pk=receipt_id).first()
    if receipt is None:
        logger.warning("El comprobante %s ya no existe.", receipt_id)
        return
    print_receipt(receipt, open_drawer=open_drawer)
