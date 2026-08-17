"""Señales de dominio de inventario."""

from __future__ import annotations

import django.dispatch

stock_movement_registered = django.dispatch.Signal()
