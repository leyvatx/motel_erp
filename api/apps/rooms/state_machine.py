"""Máquina de estados de la habitación y de la renta.

Prohibido asignar ``Room.status`` directamente en una vista: toda transición
pasa por ``transition_room`` para que quede validada y registrada.
"""

from __future__ import annotations

from typing import Iterable

from common.exceptions import InvalidStateTransition

from apps.rooms.constants import RoomStatus, StayStatus

#: Grafo de transiciones permitidas del ciclo de vida de una habitación.
#:
#:   AVAILABLE -> OCCUPIED -> CLEANING -> AVAILABLE
#:        \-> RESERVED -> OCCUPIED
#:        \-> MAINTENANCE / BLOCKED (rama de servicio)
ROOM_TRANSITIONS: dict[str, frozenset[str]] = {
    RoomStatus.AVAILABLE: frozenset(
        {
            RoomStatus.RESERVED,
            RoomStatus.OCCUPIED,
            RoomStatus.CLEANING,
            RoomStatus.MAINTENANCE,
            RoomStatus.BLOCKED,
        }
    ),
    RoomStatus.RESERVED: frozenset(
        {
            RoomStatus.OCCUPIED,
            RoomStatus.AVAILABLE,
            RoomStatus.MAINTENANCE,
            RoomStatus.BLOCKED,
        }
    ),
    # OCCUPIED -> AVAILABLE existe únicamente para revertir una renta
    # capturada por error (``cancel_stay``). El check-out normal siempre
    # pasa por CLEANING.
    RoomStatus.OCCUPIED: frozenset(
        {
            RoomStatus.CLEANING,
            RoomStatus.MAINTENANCE,
            RoomStatus.AVAILABLE,
        }
    ),
    RoomStatus.CLEANING: frozenset(
        {
            RoomStatus.AVAILABLE,
            RoomStatus.MAINTENANCE,
            RoomStatus.BLOCKED,
        }
    ),
    RoomStatus.MAINTENANCE: frozenset(
        {
            RoomStatus.CLEANING,
            RoomStatus.AVAILABLE,
            RoomStatus.BLOCKED,
        }
    ),
    RoomStatus.BLOCKED: frozenset(
        {
            RoomStatus.AVAILABLE,
            RoomStatus.MAINTENANCE,
            RoomStatus.CLEANING,
        }
    ),
}

#: Ciclo de vida de una renta.
STAY_TRANSITIONS: dict[str, frozenset[str]] = {
    StayStatus.ACTIVE: frozenset({StayStatus.CLOSED, StayStatus.CANCELLED}),
    StayStatus.CLOSED: frozenset(),
    StayStatus.CANCELLED: frozenset(),
}


def allowed_room_targets(current: str) -> Iterable[str]:
    return ROOM_TRANSITIONS.get(current, frozenset())


def validate_room_transition(current: str, target: str) -> None:
    """Levanta ``InvalidStateTransition`` si el salto de estado es ilegal."""
    if current == target:
        return
    if target not in ROOM_TRANSITIONS.get(current, frozenset()):
        raise InvalidStateTransition(
            detail=(
                f"No se permite pasar la habitacion de "
                f"'{RoomStatus(current).label}' a '{RoomStatus(target).label}'."
            ),
            current_status=current,
            target_status=target,
            allowed=sorted(ROOM_TRANSITIONS.get(current, frozenset())),
        )


def validate_stay_transition(current: str, target: str) -> None:
    if current == target:
        return
    if target not in STAY_TRANSITIONS.get(current, frozenset()):
        raise InvalidStateTransition(
            detail=(
                f"No se permite pasar la renta de "
                f"'{StayStatus(current).label}' a '{StayStatus(target).label}'."
            ),
            current_status=current,
            target_status=target,
            allowed=sorted(STAY_TRANSITIONS.get(current, frozenset())),
        )
