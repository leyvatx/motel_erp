"""Señales de dominio de caja."""

from __future__ import annotations

import django.dispatch

shift_opened = django.dispatch.Signal()

shift_closed = django.dispatch.Signal()

expense_reviewed = django.dispatch.Signal()
