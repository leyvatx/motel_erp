"""Señales de dominio del modulo de habitaciones.

Los handlers concretos (emisión de eventos WebSocket al cambiar el estado de
un cuarto y creacion automática de la tarea de limpieza al cerrar una renta)
se implementan en las Fases 3 y 4. Este modulo declara las señales para que
otros modulos puedan suscribirse desde ya sin acoplarse a los services.
"""

from __future__ import annotations

import django.dispatch

room_status_changed = django.dispatch.Signal()

stay_started = django.dispatch.Signal()

stay_extended = django.dispatch.Signal()

stay_closed = django.dispatch.Signal()

stay_cancelled = django.dispatch.Signal()
