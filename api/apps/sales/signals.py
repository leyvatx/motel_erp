"""Señales de dominio del modulo de ventas.

Los services las emiten; quien quiera reaccionar (tiempo real, impresión de
comandas, auditoría) se suscribe sin que ventas conozca a nadie.
"""

from __future__ import annotations

import django.dispatch

#: kwargs: order, actor
order_created = django.dispatch.Signal()

#: kwargs: order, actor
order_delivered = django.dispatch.Signal()

#: kwargs: order, reason, actor
order_cancelled = django.dispatch.Signal()

#: kwargs: folio, payment, actor
payment_registered = django.dispatch.Signal()

#: kwargs: folio, actor
folio_closed = django.dispatch.Signal()
