"""Pruebas del flujo de recepción (Fase 2)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from common.exceptions import DomainError, InvalidStateTransition, ResourceUnavailable

from apps.finances.services import open_shift
from apps.rooms import services
from apps.rooms.constants import (
    PriceMode,
    ReservationStatus,
    RoomStatus,
    StayStatus,
    TariffRuleType,
)
from apps.rooms.models import Room, RoomStatusLog, RoomType, Stay, TariffBlock
from apps.rooms.state_machine import validate_room_transition
from apps.sales.constants import ChargeType, FolioStatus, PaymentMethod
from apps.users.constants import Role
from apps.users.models import User


class FrontDeskTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.user = User.objects.create_user(
            username="recepcion1", password="Demo.1234", full_name="Ana Recepción",
            role=Role.RECEPTION,
        )
        cls.room_type = RoomType.objects.create(
            name="Sencilla", code="SEN", max_occupants=2, extra_person_price=Decimal("80.00")
        )
        cls.room = Room.objects.create(number="101", room_type=cls.room_type, floor=1)
        cls.block4 = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="4 horas",
            duration_minutes=240,
            base_price=Decimal("350.00"),
            grace_minutes=15,
            overstay_hour_price=Decimal("100.00"),
        )
        cls.block_night = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="Pernocta",
            duration_minutes=720,
            base_price=Decimal("600.00"),
            is_overnight=True,
        )
        cls.shift = open_shift(cashier=cls.user, opening_balance=Decimal("500.00"))


class RentRoomTests(FrontDeskTestCase):
    def test_renta_ocupa_cuarto_y_abre_folio(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk,
            tariff_block_id=self.block4.pk,
            actor=self.user,
            vehicle_plate="abc123",
        )

        self.room.refresh_from_db()
        self.assertEqual(self.room.status, RoomStatus.OCCUPIED)
        self.assertEqual(stay.status, StayStatus.ACTIVE)
        self.assertEqual(stay.vehicle_plate, "ABC123")
        self.assertEqual(
            stay.expires_at - stay.check_in_at, timedelta(minutes=self.block4.duration_minutes)
        )

        folio = stay.folio
        self.assertEqual(folio.status, FolioStatus.OPEN)
        self.assertEqual(folio.total, Decimal("350.00"))
        self.assertEqual(folio.charges.filter(charge_type=ChargeType.ROOM_RENT).count(), 1)
        self.assertTrue(
            RoomStatusLog.objects.filter(
                room=self.room, to_status=RoomStatus.OCCUPIED, stay=stay
            ).exists()
        )

    def test_no_permite_dos_rentas_en_el_mismo_cuarto(self) -> None:
        services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        with self.assertRaises(ResourceUnavailable):
            services.rent_room(
                room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
            )

    def test_cobra_persona_adicional(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk,
            tariff_block_id=self.block4.pk,
            actor=self.user,
            occupants=3,
        )
        self.assertEqual(stay.extra_person_price, Decimal("80.00"))
        self.assertEqual(stay.folio.total, Decimal("430.00"))

    def test_bloque_de_otro_tipo_de_cuarto_es_rechazado(self) -> None:
        otro_tipo = RoomType.objects.create(name="Jacuzzi", code="JAC")
        bloque_ajeno = TariffBlock.objects.create(
            room_type=otro_tipo, name="4 horas", duration_minutes=240, base_price=Decimal("500")
        )
        with self.assertRaises(DomainError):
            services.rent_room(
                room_id=self.room.pk, tariff_block_id=bloque_ajeno.pk, actor=self.user
            )

    def test_cuarto_en_limpieza_no_se_renta(self) -> None:
        services.transition_room(self.room, RoomStatus.CLEANING, actor=self.user)
        with self.assertRaises(ResourceUnavailable):
            services.rent_room(
                room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
            )


class TariffRuleTests(FrontDeskTestCase):
    def test_regla_de_fin_de_semana_sobrescribe_precio_base(self) -> None:
        hoy = services.to_business_time(timezone.now())
        self.block4.rules.create(
            name="Tarifa del día",
            rule_type=TariffRuleType.WEEKDAY,
            weekdays=[hoy.weekday()],
            price_mode=PriceMode.FIXED,
            value=Decimal("500.00"),
            priority=200,
        )
        self.assertEqual(services.resolve_tariff_price(self.block4), Decimal("500.00"))

    def test_multiplicador_aplica_sobre_precio_base(self) -> None:
        hoy = services.to_business_time(timezone.now())
        self.block4.rules.create(
            name="Festivo",
            rule_type=TariffRuleType.WEEKDAY,
            weekdays=[hoy.weekday()],
            price_mode=PriceMode.MULTIPLIER,
            value=Decimal("1.20"),
            priority=100,
        )
        self.assertEqual(services.resolve_tariff_price(self.block4), Decimal("420.00"))


class ExtensionTests(FrontDeskTestCase):
    def test_extension_recorre_vencimiento_y_carga_al_folio(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        vencimiento_original = stay.expires_at

        services.extend_stay(
            stay_id=stay.pk, actor=self.user, minutes=60, price=Decimal("120.00")
        )

        stay.refresh_from_db()
        self.assertEqual(stay.expires_at, vencimiento_original + timedelta(minutes=60))
        self.assertEqual(stay.extended_minutes, 60)
        self.assertEqual(stay.folio.total, Decimal("470.00"))
        self.assertEqual(stay.folio.charges.filter(charge_type=ChargeType.EXTENSION).count(), 1)

    def test_extension_sin_minutos_ni_bloque_falla(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        with self.assertRaises(DomainError):
            services.extend_stay(stay_id=stay.pk, actor=self.user, minutes=0)

    def test_extension_choca_con_reservacion_confirmada(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        services.create_reservation(
            room_type_id=self.room_type.pk,
            room_id=self.room.pk,
            scheduled_start=stay.expires_at + timedelta(minutes=30),
            scheduled_end=stay.expires_at + timedelta(hours=4),
            actor=self.user,
            guest_name="Cliente con reserva",
        )
        with self.assertRaises(ResourceUnavailable):
            services.extend_stay(
                stay_id=stay.pk, actor=self.user, minutes=120, price=Decimal("200.00")
            )


class ReservationTests(FrontDeskTestCase):
    def test_reservacion_bloquea_renta_traslapada(self) -> None:
        inicio = timezone.now() + timedelta(minutes=30)
        services.create_reservation(
            room_type_id=self.room_type.pk,
            room_id=self.room.pk,
            scheduled_start=inicio,
            scheduled_end=inicio + timedelta(hours=4),
            actor=self.user,
        )
        with self.assertRaises(ResourceUnavailable):
            services.rent_room(
                room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
            )

    def test_check_in_de_su_propia_reservacion_si_procede(self) -> None:
        inicio = timezone.now() + timedelta(minutes=10)
        reservation = services.create_reservation(
            room_type_id=self.room_type.pk,
            room_id=self.room.pk,
            scheduled_start=inicio,
            scheduled_end=inicio + timedelta(hours=4),
            actor=self.user,
            deposit_amount=Decimal("100.00"),
        )
        stay = services.rent_room(
            room_id=self.room.pk,
            tariff_block_id=self.block4.pk,
            actor=self.user,
            reservation_id=reservation.pk,
        )
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, ReservationStatus.CHECKED_IN)
        self.assertEqual(stay.folio.total, Decimal("250.00"))

    def test_cancelar_reservacion_libera_la_ventana(self) -> None:
        inicio = timezone.now() + timedelta(minutes=30)
        reservation = services.create_reservation(
            room_type_id=self.room_type.pk,
            room_id=self.room.pk,
            scheduled_start=inicio,
            scheduled_end=inicio + timedelta(hours=4),
            actor=self.user,
        )
        services.cancel_reservation(
            reservation_id=reservation.pk, reason="El cliente no llego", actor=self.user
        )
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        self.assertEqual(stay.status, StayStatus.ACTIVE)


class CheckoutTests(FrontDeskTestCase):
    def test_checkout_cobrado_cierra_folio_y_manda_a_limpieza(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        services.checkout_stay(
            stay_id=stay.pk,
            actor=self.user,
            payments=[
                {
                    "method": PaymentMethod.CASH,
                    "amount": Decimal("350.00"),
                    "tendered_amount": Decimal("500.00"),
                }
            ],
        )

        stay.refresh_from_db()
        self.room.refresh_from_db()
        folio = stay.folio

        self.assertEqual(stay.status, StayStatus.CLOSED)
        self.assertEqual(self.room.status, RoomStatus.CLEANING)
        self.assertEqual(folio.status, FolioStatus.CLOSED)
        self.assertEqual(folio.paid_total, Decimal("350.00"))
        self.assertEqual(folio.payments.first().change_amount, Decimal("150.00"))

    def test_checkout_sin_pago_no_cierra(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        with self.assertRaises(DomainError):
            services.checkout_stay(stay_id=stay.pk, actor=self.user)

        stay.refresh_from_db()
        self.assertEqual(stay.status, StayStatus.ACTIVE)

    def test_recargo_por_sobreestadia(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        ahora = timezone.now()
        Stay.objects.filter(pk=stay.pk).update(
            check_in_at=ahora - timedelta(minutes=330),
            expires_at=ahora - timedelta(minutes=90),
        )
        stay.refresh_from_db()

        horas, importe = services.compute_overstay_surcharge(stay)
        self.assertEqual(horas, 2)
        self.assertEqual(importe, Decimal("200.00"))

        services.checkout_stay(
            stay_id=stay.pk,
            actor=self.user,
            payments=[{"method": PaymentMethod.CARD, "amount": Decimal("550.00")}],
        )
        stay.refresh_from_db()
        self.assertEqual(stay.folio.total, Decimal("550.00"))
        self.assertEqual(stay.folio.status, FolioStatus.CLOSED)


class CancellationTests(FrontDeskTestCase):
    def test_cancelar_renta_libera_cuarto_y_anula_folio(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        services.cancel_stay(stay_id=stay.pk, reason="Captura equivocada", actor=self.user)

        stay.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(stay.status, StayStatus.CANCELLED)
        self.assertEqual(self.room.status, RoomStatus.AVAILABLE)
        self.assertEqual(stay.folio.status, FolioStatus.CANCELLED)
        self.assertEqual(stay.folio.total, Decimal("0.00"))

    def test_cancelacion_exige_motivo(self) -> None:
        stay = services.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block4.pk, actor=self.user
        )
        with self.assertRaises(DomainError):
            services.cancel_stay(stay_id=stay.pk, reason="", actor=self.user)


class StateMachineTests(TestCase):
    def test_transicion_ilegal_es_rechazada(self) -> None:
        with self.assertRaises(InvalidStateTransition):
            validate_room_transition(RoomStatus.CLEANING, RoomStatus.OCCUPIED)

    def test_transicion_valida_pasa(self) -> None:
        validate_room_transition(RoomStatus.CLEANING, RoomStatus.AVAILABLE)
