"""Señales de dominio de caja."""

from __future__ import annotations

import django.dispatch

#: kwargs: shift, actor
shift_opened = django.dispatch.Signal()

#: kwargs: shift, actor
shift_closed = django.dispatch.Signal()

#: kwargs: expense, approved, actor
expense_reviewed = django.dispatch.Signal()
