"""Señales de dominio del modulo de ventas.

Los services las emiten; quien quiera reaccionar (tiempo real, impresión de
comandas, auditoría) se suscribe sin que ventas conozca a nadie.
"""

from __future__ import annotations

import django.dispatch

order_created = django.dispatch.Signal()

order_delivered = django.dispatch.Signal()

order_cancelled = django.dispatch.Signal()

payment_registered = django.dispatch.Signal()

folio_closed = django.dispatch.Signal()
