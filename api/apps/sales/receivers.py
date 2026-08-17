"""Automatismos de ventas.

Al cerrar una cuenta se emite su ticket sin que recepción tenga que pedirlo.
La impresión nunca bloquea el cobro: el comprobante se guarda primero y se
manda a la cola después del commit.
"""

from __future__ import annotations

from django.conf import settings
from django.dispatch import receiver

from apps.sales import signals


@receiver(signals.folio_closed, dispatch_uid="sales_emit_receipt_on_close")
def on_folio_closed(sender, folio, actor=None, **kwargs):
    if not settings.PRINT_TICKET_ON_FOLIO_CLOSE:
        return

    from apps.sales.receipts import emit_folio_receipt

    emit_folio_receipt(folio=folio, actor=actor)
