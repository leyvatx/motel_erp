"""Señales de dominio de inventario."""

from __future__ import annotations

import django.dispatch

#: kwargs: movement, actor
stock_movement_registered = django.dispatch.Signal()
