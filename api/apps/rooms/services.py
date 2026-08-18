"""Capa de servicios de recepción: rentar, extender, cobrar y cancelar.

Invariantes que garantiza este modulo:
* Nunca hay dos rentas activas sobre la misma habitación: se bloquea la fila
  del cuarto con ``select_for_update`` y la base de datos remata con una
  restriccion única parcial.
* ``expires_at`` lo calcula siempre el servidor a partir de la duración del
  bloque tarifario. El cliente jamás envia la hora de vencimiento.
* Ninguna renta se registra si choca con una reservación ya confirmada.
* El estado del cuarto solo se mueve por la máquina de estados y cada salto
  queda escrito en ``RoomStatusLog``.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Sequence

from django.db import transaction
from django.utils import timezone

from common.exceptions import DomainError, ResourceUnavailable
from common.models import DocumentSequence
from common.utils import ZERO, money, period_key, to_business_time

from apps.rooms import signals
from apps.rooms.constants import (
    PriceMode,
    ReservationStatus,
    RoomStatus,
    StayStatus,
    TariffRuleType,
)
from apps.rooms.models import (
    Holiday,
    Reservation,
    Room,
    RoomStatusLog,
    Stay,
    StayExtension,
    TariffBlock,
)
from apps.rooms.state_machine import validate_room_transition, validate_stay_transition
from apps.sales import services as sales_services
from apps.sales.constants import ChargeType, FolioStatus, FolioType

BLOCKING_RESERVATION_STATUSES = (ReservationStatus.PENDING, ReservationStatus.CONFIRMED)


def resolve_tariff_price(tariff_block: TariffBlock, moment: datetime | None = None) -> Decimal:
    """Precio vigente del bloque para un instante dado.

    Gana la regla activa de mayor prioridad que aplique a la fecha/hora local
    del motel. Si ninguna aplica, se cobra el precio base del bloque.
    """
    moment = moment or timezone.now()
    local = to_business_time(moment)
    local_date = local.date()
    local_time = local.time()
    weekday = local.weekday()

    is_holiday = Holiday.objects.filter(date=local_date, is_active=True).exists()

    for rule in tariff_block.rules.filter(is_active=True).order_by("-priority", "id"):
        if not _rule_matches(rule, local_date, local_time, weekday, is_holiday):
            continue
        if rule.price_mode == PriceMode.FIXED:
            return money(rule.value)
        if rule.price_mode == PriceMode.MULTIPLIER:
            return money(tariff_block.base_price * rule.value)
        return money(tariff_block.base_price + rule.value)

    return money(tariff_block.base_price)


def _rule_matches(rule, local_date, local_time, weekday: int, is_holiday: bool) -> bool:
    if rule.start_time and rule.end_time:
        if rule.start_time <= rule.end_time:
            if not (rule.start_time <= local_time <= rule.end_time):
                return False
        elif not (local_time >= rule.start_time or local_time <= rule.end_time):
            return False

    if rule.rule_type == TariffRuleType.WEEKDAY:
        return weekday in (rule.weekdays or [])
    if rule.rule_type == TariffRuleType.DATE_RANGE:
        if rule.start_date and local_date < rule.start_date:
            return False
        if rule.end_date and local_date > rule.end_date:
            return False
        return True
    if rule.rule_type == TariffRuleType.HOLIDAY:
        return is_holiday
    return False


def transition_room(
    room: Room,
    target_status: str,
    *,
    actor=None,
    reason: str = "",
    stay: Stay | None = None,
) -> Room:
    """Aplica y registra una transición de estado de habitación.

    El llamador debe tener bloqueada la fila del cuarto si la operación
    compite por el recurso (renta, check-out, cancelación).
    """
    previous = room.status
    validate_room_transition(previous, target_status)
    if previous == target_status:
        return room

    room.status = target_status
    room.status_changed_at = timezone.now()
    if target_status in {RoomStatus.MAINTENANCE, RoomStatus.BLOCKED}:
        room.out_of_service_reason = reason[:255]
    elif previous in {RoomStatus.MAINTENANCE, RoomStatus.BLOCKED}:
        room.out_of_service_reason = ""
    room.updated_by = actor
    room.save(
        update_fields=[
            "status",
            "status_changed_at",
            "out_of_service_reason",
            "updated_by",
            "updated_at",
        ]
    )

    RoomStatusLog.objects.create(
        room=room,
        stay=stay,
        from_status=previous,
        to_status=target_status,
        reason=reason[:255],
        changed_by=actor,
    )
    signals.room_status_changed.send(
        sender=Room,
        room=room,
        from_status=previous,
        to_status=target_status,
        stay=stay,
        actor=actor,
    )
    return room


def find_conflicting_reservation(
    *,
    room: Room,
    start: datetime,
    end: datetime,
    exclude_reservation_id: int | None = None,
) -> Reservation | None:
    """Reservación vigente que se traslapa con la ventana solicitada."""
    queryset = Reservation.objects.filter(
        room=room,
        is_active=True,
        status__in=BLOCKING_RESERVATION_STATUSES,
        scheduled_start__lt=end,
        scheduled_end__gt=start,
    )
    if exclude_reservation_id:
        queryset = queryset.exclude(pk=exclude_reservation_id)
    return queryset.order_by("scheduled_start").first()


def assert_no_reservation_conflict(
    *,
    room: Room,
    start: datetime,
    end: datetime,
    exclude_reservation_id: int | None = None,
) -> None:
    conflict = find_conflicting_reservation(
        room=room, start=start, end=end, exclude_reservation_id=exclude_reservation_id
    )
    if conflict is not None:
        raise ResourceUnavailable(
            detail=(
                f"La habitacion {room.number} tiene la reservacion {conflict.code} "
                f"del {to_business_time(conflict.scheduled_start):%d/%m %H:%M} "
                f"al {to_business_time(conflict.scheduled_end):%d/%m %H:%M}."
            ),
            code="reservation_conflict",
            reservation_id=conflict.pk,
            reservation_code=conflict.code,
        )


@transaction.atomic
def create_reservation(
    *,
    room_type_id: int,
    scheduled_start: datetime,
    scheduled_end: datetime,
    actor,
    room_id: int | None = None,
    tariff_block_id: int | None = None,
    guest_name: str = "",
    guest_phone: str = "",
    vehicle_plate: str = "",
    occupants: int = 2,
    deposit_amount: Decimal = ZERO,
    notes: str = "",
) -> Reservation:
    if scheduled_end <= scheduled_start:
        raise DomainError("El fin de la reservación debe ser posterior al inicio.", code="invalid_window")
    if scheduled_start < timezone.now() - timedelta(minutes=5):
        raise DomainError("No se puede reservar en el pasado.", code="reservation_in_past")

    room = None
    if room_id:
        room = Room.objects.select_for_update().get(pk=room_id, is_active=True)
        if room.room_type_id != room_type_id:
            raise DomainError(
                "La habitación no corresponde al tipo seleccionado.",
                code="reservation_room_type_mismatch",
            )
        assert_no_reservation_conflict(room=room, start=scheduled_start, end=scheduled_end)
        _assert_no_active_stay_overlap(room=room, start=scheduled_start, end=scheduled_end)

    tariff_block = None
    quoted = ZERO
    if tariff_block_id:
        tariff_block = TariffBlock.objects.get(pk=tariff_block_id, is_active=True)
        if tariff_block.room_type_id != room_type_id:
            raise DomainError(
                "La tarifa no corresponde al tipo de habitación seleccionado.",
                code="reservation_tariff_mismatch",
            )
        quoted = resolve_tariff_price(tariff_block, scheduled_start)

    return Reservation.objects.create(
        code=DocumentSequence.next_value("reservation", "RES", period_key()),
        room=room,
        room_type_id=room_type_id,
        tariff_block=tariff_block,
        status=ReservationStatus.CONFIRMED,
        guest_name=guest_name,
        guest_phone=guest_phone,
        vehicle_plate=vehicle_plate.upper(),
        occupants=occupants,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        deposit_amount=money(deposit_amount),
        quoted_price=quoted,
        notes=notes,
        created_by=actor,
    )


def _assert_no_active_stay_overlap(*, room: Room, start: datetime, end: datetime) -> None:
    """Impide reservar sobre una renta activa que todavía no termina."""
    active = room.stays.filter(status=StayStatus.ACTIVE).first()
    if active and active.expires_at > start and active.check_in_at < end:
        raise ResourceUnavailable(
            detail=(
                f"La habitacion {room.number} esta ocupada hasta las "
                f"{to_business_time(active.expires_at):%d/%m %H:%M}."
            ),
            code="stay_conflict",
            stay_id=active.pk,
        )


@transaction.atomic
def cancel_reservation(*, reservation_id: int, reason: str, actor) -> Reservation:
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    reservation = Reservation.objects.select_for_update().get(pk=reservation_id, is_active=True)
    if reservation.status not in BLOCKING_RESERVATION_STATUSES:
        raise DomainError(
            "La reservación no se puede cancelar en su estado actual.",
            code="invalid_reservation_status",
            status=reservation.status,
        )

    reservation.status = ReservationStatus.CANCELLED
    reservation.cancelled_at = timezone.now()
    reservation.cancellation_reason = reason[:255]
    reservation.updated_by = actor
    reservation.save(
        update_fields=["status", "cancelled_at", "cancellation_reason", "updated_by", "updated_at"]
    )

    if reservation.room_id and reservation.room.status == RoomStatus.RESERVED:
        room = Room.objects.select_for_update().get(pk=reservation.room_id)
        transition_room(
            room, RoomStatus.AVAILABLE, actor=actor, reason=f"Reservacion cancelada: {reason}"
        )
    return reservation


@transaction.atomic
def mark_reservation_no_show(*, reservation_id: int, actor) -> Reservation:
    reservation = Reservation.objects.select_for_update().get(pk=reservation_id, is_active=True)
    if reservation.status not in BLOCKING_RESERVATION_STATUSES:
        raise DomainError(
            "La reservación no se puede marcar como no-show.",
            code="invalid_reservation_status",
        )
    reservation.status = ReservationStatus.NO_SHOW
    reservation.updated_by = actor
    reservation.save(update_fields=["status", "updated_by", "updated_at"])
    return reservation


@transaction.atomic
def rent_room(
    *,
    room_id: int,
    tariff_block_id: int,
    actor,
    occupants: int = 2,
    guest_name: str = "",
    vehicle_plate: str = "",
    vehicle_description: str = "",
    notes: str = "",
    reservation_id: int | None = None,
    check_in_at: datetime | None = None,
) -> Stay:
    """Registra una renta (walk-in o llegada de reservación).

    Deja la habitación en OCCUPIED, abre el folio y carga la renta.
    """
    room = (
        Room.objects.select_for_update()
        .select_related("room_type")
        .get(pk=room_id, is_active=True)
    )
    tariff_block = TariffBlock.objects.select_related("room_type").get(
        pk=tariff_block_id, is_active=True
    )

    if tariff_block.room_type_id != room.room_type_id:
        raise DomainError(
            "El bloque tarifario no corresponde al tipo de esta habitación.",
            code="tariff_room_type_mismatch",
        )
    if room.status not in {RoomStatus.AVAILABLE, RoomStatus.RESERVED}:
        raise ResourceUnavailable(
            detail=f"La habitacion {room.number} esta en estado '{room.get_status_display()}'.",
            code="room_not_available",
            room_status=room.status,
        )
    if room.stays.filter(status=StayStatus.ACTIVE).exists():
        raise ResourceUnavailable(
            detail=f"La habitacion {room.number} ya tiene una renta activa.",
            code="room_already_occupied",
        )

    now = check_in_at or timezone.now()
    expires_at = now + timedelta(minutes=tariff_block.duration_minutes)

    reservation = None
    if reservation_id:
        reservation = Reservation.objects.select_for_update().get(pk=reservation_id, is_active=True)
        if reservation.status not in BLOCKING_RESERVATION_STATUSES:
            raise DomainError(
                "La reservación no está vigente.", code="invalid_reservation_status"
            )
        if reservation.room_id and reservation.room_id != room.pk:
            raise DomainError(
                "La reservación corresponde a otra habitación.", code="reservation_room_mismatch"
            )
        if reservation.room_type_id != room.room_type_id:
            raise DomainError(
                "La habitación no corresponde al tipo reservado.",
                code="reservation_room_type_mismatch",
            )

    assert_no_reservation_conflict(
        room=room, start=now, end=expires_at, exclude_reservation_id=reservation_id
    )

    price = resolve_tariff_price(tariff_block, now)
    extra_people = max(occupants - room.room_type.max_occupants, 0)
    extra_price = money(room.room_type.extra_person_price * extra_people)

    stay = Stay.objects.create(
        code=DocumentSequence.next_value("stay", "R", period_key(now)),
        room=room,
        room_type=room.room_type,
        tariff_block=tariff_block,
        reservation=reservation,
        status=StayStatus.ACTIVE,
        check_in_at=now,
        expires_at=expires_at,
        base_minutes=tariff_block.duration_minutes,
        base_price=price,
        extra_person_price=extra_price,
        occupants=occupants,
        guest_name=guest_name,
        vehicle_plate=vehicle_plate.upper(),
        vehicle_description=vehicle_description,
        notes=notes,
        created_by=actor,
    )

    transition_room(
        room,
        RoomStatus.OCCUPIED,
        actor=actor,
        reason=f"Renta {stay.code}",
        stay=stay,
    )

    if reservation is not None:
        reservation.status = ReservationStatus.CHECKED_IN
        reservation.updated_by = actor
        reservation.save(update_fields=["status", "updated_by", "updated_at"])

    folio = sales_services.open_folio(
        actor=actor, stay=stay, room=room, folio_type=FolioType.ROOM
    )
    sales_services.add_charge(
        folio=folio,
        charge_type=ChargeType.ROOM_RENT,
        description=f"{room.room_type.name} - {tariff_block.name} (Hab. {room.number})",
        unit_price=price,
        actor=actor,
    )
    if extra_price > ZERO:
        sales_services.add_charge(
            folio=folio,
            charge_type=ChargeType.EXTRA_PERSON,
            description=f"Personas adicionales ({extra_people})",
            unit_price=extra_price,
            actor=actor,
        )

    if reservation is not None and reservation.deposit_amount > ZERO:
        sales_services.add_charge(
            folio=folio,
            charge_type=ChargeType.ADJUSTMENT,
            description=f"Anticipo aplicado - reservacion {reservation.code}",
            unit_price=-reservation.deposit_amount,
            actor=actor,
        )

    signals.stay_started.send(sender=Stay, stay=stay, actor=actor)
    return stay


@transaction.atomic
def extend_stay(
    *,
    stay_id: int,
    actor,
    tariff_block_id: int | None = None,
    minutes: int | None = None,
    price: Decimal | None = None,
    reason: str = "",
) -> StayExtension:
    """Prolonga una renta activa.

    El tiempo se agrega a partir del vencimiento vigente; si la renta ya se
    paso de la hora, se cuenta desde ahora para no regalar tiempo.
    """
    stay = (
        Stay.objects.select_for_update(of=("self",))
        .select_related("room", "tariff_block", "folio")
        .get(pk=stay_id, is_active=True)
    )
    if stay.status != StayStatus.ACTIVE:
        raise DomainError("Solo se pueden extender rentas activas.", code="stay_not_active")

    tariff_block = None
    if tariff_block_id:
        tariff_block = TariffBlock.objects.get(pk=tariff_block_id, is_active=True)
        if tariff_block.room_type_id != stay.room_type_id:
            raise DomainError(
                "El bloque tarifario no corresponde al tipo de habitación.",
                code="tariff_room_type_mismatch",
            )
        minutes = tariff_block.duration_minutes
        price = resolve_tariff_price(tariff_block, timezone.now()) if price is None else price

    if not minutes or minutes <= 0:
        raise DomainError("La extensión requiere minutos o un bloque tarifario.", code="invalid_extension")
    if price is None:
        raise DomainError("La extensión requiere un importe.", code="price_required")

    now = timezone.now()
    base_moment = max(stay.expires_at, now)
    new_expires_at = base_moment + timedelta(minutes=minutes)

    room = Room.objects.select_for_update().get(pk=stay.room_id)
    assert_no_reservation_conflict(room=room, start=stay.expires_at, end=new_expires_at)

    extension = StayExtension.objects.create(
        stay=stay,
        tariff_block=tariff_block,
        minutes=minutes,
        price=money(price),
        previous_expires_at=stay.expires_at,
        new_expires_at=new_expires_at,
        reason=reason[:255],
        created_by=actor,
    )

    stay.expires_at = new_expires_at
    stay.extended_minutes += minutes
    stay.warning_notified_at = None
    stay.expired_notified_at = None
    stay.updated_by = actor
    stay.save(
        update_fields=[
            "expires_at",
            "extended_minutes",
            "warning_notified_at",
            "expired_notified_at",
            "updated_by",
            "updated_at",
        ]
    )

    folio = _get_open_folio(stay)
    sales_services.add_charge(
        folio=folio,
        charge_type=ChargeType.EXTENSION,
        description=f"Extension de {minutes} min (Hab. {stay.room.number})",
        unit_price=money(price),
        actor=actor,
        stay_extension=extension,
    )

    signals.stay_extended.send(sender=Stay, stay=stay, extension=extension, actor=actor)
    return extension


def _get_open_folio(stay: Stay):
    folio = getattr(stay, "folio", None)
    if folio is None or folio.status != FolioStatus.OPEN:
        raise DomainError(
            "La renta no tiene una cuenta abierta.", code="folio_not_open", stay_id=stay.pk
        )
    return sales_services.lock_folio(folio.pk)


def compute_overstay_surcharge(stay: Stay, moment: datetime | None = None) -> tuple[int, Decimal]:
    """Horas excedidas (después de la tolerancia) y su importe."""
    moment = moment or timezone.now()
    deadline = stay.expires_at + timedelta(minutes=stay.tariff_block.grace_minutes)
    if moment <= deadline or stay.tariff_block.overstay_hour_price <= ZERO:
        return 0, ZERO

    hours = math.ceil((moment - deadline).total_seconds() / 3600)
    return hours, money(stay.tariff_block.overstay_hour_price * hours)


@transaction.atomic
def checkout_stay(
    *,
    stay_id: int,
    actor,
    payments: Sequence[dict] | None = None,
    apply_overstay: bool = True,
    discount: Decimal | None = None,
    discount_reason: str = "",
) -> Stay:
    """Cierra la renta: recargo por sobreestadia, cobro, cierre de folio y limpieza.

    ``payments`` es una lista de ``{"method", "amount", "tendered_amount", "reference"}``.
    """
    stay = (
        Stay.objects.select_for_update(of=("self",))
        .select_related("room", "tariff_block", "folio")
        .get(pk=stay_id, is_active=True)
    )
    validate_stay_transition(stay.status, StayStatus.CLOSED)

    folio = _get_open_folio(stay)
    now = timezone.now()

    if apply_overstay:
        hours, amount = compute_overstay_surcharge(stay, now)
        if hours > 0:
            sales_services.add_charge(
                folio=folio,
                charge_type=ChargeType.OVERSTAY,
                description=f"Recargo por {hours} h excedida(s)",
                unit_price=amount,
                actor=actor,
            )

    if discount:
        sales_services.apply_discount(
            folio_id=folio.pk, amount=discount, reason=discount_reason or "Cortesia", actor=actor
        )

    for payment in payments or []:
        sales_services.register_payment(
            folio_id=folio.pk,
            method=payment["method"],
            amount=payment["amount"],
            tendered_amount=payment.get("tendered_amount"),
            reference=payment.get("reference", ""),
            actor=actor,
        )

    sales_services.close_folio(folio_id=folio.pk, actor=actor)

    stay.status = StayStatus.CLOSED
    stay.checked_out_at = now
    stay.closed_by = actor
    stay.updated_by = actor
    stay.save(
        update_fields=["status", "checked_out_at", "closed_by", "updated_by", "updated_at"]
    )

    room = Room.objects.select_for_update().get(pk=stay.room_id)
    transition_room(
        room, RoomStatus.CLEANING, actor=actor, reason=f"Salida de renta {stay.code}", stay=stay
    )

    signals.stay_closed.send(sender=Stay, stay=stay, actor=actor)
    return stay


@transaction.atomic
def cancel_stay(*, stay_id: int, reason: str, actor) -> Stay:
    """Cancela una renta capturada por error.

    Revierte los consumos al inventario, anula la cuenta y regresa el cuarto a
    disponible. Nada se borra: todo queda marcado y auditado.
    """
    if not reason:
        raise DomainError("La cancelación requiere un motivo.", code="reason_required")

    stay = (
        Stay.objects.select_for_update(of=("self",))
        .select_related("room", "folio")
        .get(pk=stay_id, is_active=True)
    )
    validate_stay_transition(stay.status, StayStatus.CANCELLED)

    folio = getattr(stay, "folio", None)
    if folio is not None and folio.status != FolioStatus.CANCELLED:
        sales_services.cancel_folio(folio_id=folio.pk, reason=reason, actor=actor)

    stay.status = StayStatus.CANCELLED
    stay.cancelled_at = timezone.now()
    stay.cancellation_reason = reason[:255]
    stay.updated_by = actor
    stay.save(
        update_fields=["status", "cancelled_at", "cancellation_reason", "updated_by", "updated_at"]
    )

    if stay.reservation_id:
        Reservation.objects.filter(pk=stay.reservation_id).update(
            status=ReservationStatus.CONFIRMED
        )

    room = Room.objects.select_for_update().get(pk=stay.room_id)
    transition_room(
        room,
        RoomStatus.AVAILABLE,
        actor=actor,
        reason=f"Renta {stay.code} cancelada: {reason}",
        stay=stay,
    )

    signals.stay_cancelled.send(sender=Stay, stay=stay, reason=reason, actor=actor)
    return stay


@transaction.atomic
def finish_cleaning(*, room_id: int, actor, reason: str = "") -> Room:
    """Marca el cuarto como disponible al terminar la limpieza."""
    room = Room.objects.select_for_update().get(pk=room_id, is_active=True)
    return transition_room(
        room, RoomStatus.AVAILABLE, actor=actor, reason=reason or "Limpieza terminada"
    )


@transaction.atomic
def set_room_out_of_service(*, room_id: int, actor, reason: str, blocked: bool = False) -> Room:
    """Manda el cuarto a mantenimiento o lo bloquea."""
    if not reason:
        raise DomainError("Se requiere el motivo.", code="reason_required")

    room = Room.objects.select_for_update().get(pk=room_id, is_active=True)
    if room.stays.filter(status=StayStatus.ACTIVE).exists():
        raise ResourceUnavailable(
            detail="No se puede sacar de servicio una habitación con renta activa.",
            code="room_occupied",
        )
    target = RoomStatus.BLOCKED if blocked else RoomStatus.MAINTENANCE
    return transition_room(room, target, actor=actor, reason=reason)
