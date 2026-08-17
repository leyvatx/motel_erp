"""Señales de dominio del modulo de habitaciones.

Los handlers concretos (emisión de eventos WebSocket al cambiar el estado de
un cuarto y creacion automática de la tarea de limpieza al cerrar una renta)
se implementan en las Fases 3 y 4. Este modulo declara las señales para que
otros modulos puedan suscribirse desde ya sin acoplarse a los services.
"""

from __future__ import annotations

import django.dispatch

#: Emitida al completar una transición valida de estado de habitación.
#: kwargs: room, from_status, to_status, stay, actor
room_status_changed = django.dispatch.Signal()

#: Emitida al registrar una nueva renta. kwargs: stay, actor
stay_started = django.dispatch.Signal()

#: Emitida al extender una renta. kwargs: stay, extensión, actor
stay_extended = django.dispatch.Signal()

#: Emitida al cerrar una renta (check-out). kwargs: stay, actor
stay_closed = django.dispatch.Signal()

#: Emitida al cancelar una renta. kwargs: stay, reason, actor
stay_cancelled = django.dispatch.Signal()
