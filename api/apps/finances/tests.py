"""Pruebas de caja, cortes y gastos (Fase 5)."""

from __future__ import annotations

from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from common.exceptions import DomainError, ShiftRequiredError
from common.tenancy import use_motel

from apps.finances import services
from apps.finances.constants import (
    CashDirection,
    CashMovementReason,
    ExpenseStatus,
    ShiftStatus,
)
from apps.finances.models import CashCount, CashMovement, Expense, Shift
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.settings.models import Motel
from apps.sales import services as sales_services
from apps.sales.constants import PaymentMethod
from apps.sales.models import Receipt
from apps.sales.printing import render_folio_ticket, render_shift_ticket
from apps.sales.receipts import create_folio_receipt, create_shift_receipt, render
from apps.users.constants import Role
from apps.users.models import User

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER, PRINTER_BACKEND="dummy")
class FinancesTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.cajero = User.objects.create_user(
            username="caja2", password="Demo.1234", full_name="Hugo Caja", role=Role.RECEPTION
        )
        cls.gerente = User.objects.create_user(
            username="gerente1", password="Demo.1234", full_name="Ines Gerente",
            role=Role.MANAGER,
        )
        cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
        cls.room = Room.objects.create(number="601", room_type=cls.room_type)
        cls.block = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="4 horas",
            duration_minutes=240,
            base_price=Decimal("300.00"),
        )

    def _abrir_turno(self, fondo: str = "500.00") -> Shift:
        monto = Decimal(fondo)
        return services.open_shift(
            cashier=self.cajero,
            opening_balance=monto,
            breakdown={"500": int(monto / Decimal("500"))},
        )

    def _renta_cobrada(self, metodo: str = PaymentMethod.CASH) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.cajero
        )
        frontdesk.checkout_stay(
            stay_id=stay.pk,
            actor=self.cajero,
            payments=[{"method": metodo, "amount": Decimal("300.00")}],
        )


class ShiftLifecycleTests(FinancesTestCase):
    def test_apertura_registra_fondo_y_arqueo_inicial(self) -> None:
        turno = self._abrir_turno()

        self.assertEqual(turno.status, ShiftStatus.OPEN)
        self.assertEqual(turno.opening_balance, Decimal("500.00"))
        self.assertEqual(CashCount.objects.filter(shift=turno).count(), 1)
        self.assertEqual(
            CashMovement.objects.get(shift=turno, reason=CashMovementReason.OPENING_FUND).amount,
            Decimal("500.00"),
        )

    def test_un_cajero_no_puede_tener_dos_turnos_abiertos(self) -> None:
        self._abrir_turno()
        with self.assertRaises(DomainError):
            self._abrir_turno()

    def test_cobrar_sin_turno_abierto_es_rechazado(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.cajero
        )
        with self.assertRaises(ShiftRequiredError):
            sales_services.register_payment(
                folio_id=stay.folio.pk,
                method=PaymentMethod.CASH,
                amount=Decimal("300.00"),
                actor=self.cajero,
            )

    def test_desglose_que_no_cuadra_con_el_total_es_rechazado(self) -> None:
        with self.assertRaises(DomainError):
            services.open_shift(
                cashier=self.cajero,
                opening_balance=Decimal("500.00"),
                breakdown={"100": 2},
            )

    def test_denominacion_invalida_es_rechazada(self) -> None:
        with self.assertRaises(DomainError):
            services.open_shift(
                cashier=self.cajero,
                opening_balance=Decimal("300.00"),
                breakdown={"300": 1},
            )


class BlindCashCountTests(FinancesTestCase):
    def test_corte_cuadrado_no_deja_diferencia(self) -> None:
        turno = self._abrir_turno()
        self._renta_cobrada()

        cerrado = services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("800.00"), actor=self.cajero
        )

        self.assertEqual(cerrado.status, ShiftStatus.CLOSED)
        self.assertEqual(cerrado.cash_sales, Decimal("300.00"))
        self.assertEqual(cerrado.expected_cash, Decimal("800.00"))
        self.assertEqual(cerrado.difference, Decimal("0.00"))
        self.assertEqual(cerrado.folios_closed, 1)
        self.assertEqual(cerrado.stays_closed, 1)

    def test_faltante_queda_asentado_y_no_se_puede_corregir(self) -> None:
        turno = self._abrir_turno()
        self._renta_cobrada()

        cerrado = services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("750.00"), actor=self.cajero
        )
        self.assertEqual(cerrado.difference, Decimal("-50.00"))

        with self.assertRaises(DomainError):
            services.close_shift(
                shift_id=turno.pk, declared_cash=Decimal("800.00"), actor=self.cajero
            )

    def test_pago_con_tarjeta_no_entra_al_efectivo_esperado(self) -> None:
        turno = self._abrir_turno()
        self._renta_cobrada(metodo=PaymentMethod.CARD)

        cerrado = services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("500.00"), actor=self.cajero
        )
        self.assertEqual(cerrado.card_sales, Decimal("300.00"))
        self.assertEqual(cerrado.cash_sales, Decimal("0.00"))
        self.assertEqual(cerrado.expected_cash, Decimal("500.00"))
        self.assertEqual(cerrado.difference, Decimal("0.00"))

    def test_retiro_a_boveda_baja_el_efectivo_esperado(self) -> None:
        turno = self._abrir_turno()
        self._renta_cobrada()

        services.register_cash_movement(
            shift_id=turno.pk,
            direction=CashDirection.OUT,
            amount=Decimal("600.00"),
            reason=CashMovementReason.DROP,
            actor=self.cajero,
        )
        cerrado = services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("200.00"), actor=self.cajero
        )
        self.assertEqual(cerrado.expected_cash, Decimal("200.00"))
        self.assertEqual(cerrado.difference, Decimal("0.00"))

    def test_no_se_retira_mas_efectivo_del_que_hay_en_caja(self) -> None:
        turno = self._abrir_turno()
        with self.assertRaises(DomainError):
            services.register_cash_movement(
                shift_id=turno.pk,
                direction=CashDirection.OUT,
                amount=Decimal("900.00"),
                reason=CashMovementReason.DROP,
                actor=self.cajero,
            )

    def test_arqueo_de_gerencia_marca_el_turno_verificado(self) -> None:
        turno = self._abrir_turno()
        services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("500.00"), actor=self.cajero
        )
        verificado = services.verify_shift(
            shift_id=turno.pk, counted_cash=Decimal("500.00"), actor=self.gerente,
            breakdown={"500": 1},
        )
        self.assertEqual(verificado.status, ShiftStatus.VERIFIED)
        self.assertEqual(verificado.verified_by, self.gerente)


@override_settings(EXPENSE_APPROVAL_THRESHOLD="1000.00")
class ExpenseTests(FinancesTestCase):
    def test_gasto_menor_al_umbral_se_aprueba_solo_y_sale_de_caja(self) -> None:
        turno = self._abrir_turno("2000.00")

        gasto = services.register_expense(
            amount=Decimal("300.00"),
            description="Garrafones de agua",
            actor=self.cajero,
        )

        self.assertEqual(gasto.status, ExpenseStatus.APPROVED)
        self.assertFalse(gasto.requires_approval)
        self.assertEqual(
            CashMovement.objects.get(expense=gasto).direction, CashDirection.OUT
        )
        self.assertEqual(
            services.compute_shift_totals(turno)["expected_cash"], Decimal("1700.00")
        )

    def test_gasto_sobre_el_umbral_espera_aprobacion_sin_tocar_el_efectivo(self) -> None:
        turno = self._abrir_turno("5000.00")

        gasto = services.register_expense(
            amount=Decimal("2500.00"),
            description="Reparacion de bomba de agua",
            actor=self.cajero,
        )

        self.assertEqual(gasto.status, ExpenseStatus.PENDING)
        self.assertTrue(gasto.requires_approval)
        self.assertFalse(CashMovement.objects.filter(expense=gasto).exists())
        self.assertEqual(
            services.compute_shift_totals(turno)["expected_cash"], Decimal("5000.00")
        )

    def test_aprobacion_descuenta_el_efectivo(self) -> None:
        turno = self._abrir_turno("5000.00")
        gasto = services.register_expense(
            amount=Decimal("2500.00"), description="Bomba de agua", actor=self.cajero
        )

        services.review_expense(expense_id=gasto.pk, approve=True, actor=self.gerente)

        gasto.refresh_from_db()
        self.assertEqual(gasto.status, ExpenseStatus.APPROVED)
        self.assertEqual(gasto.reviewed_by, self.gerente)
        self.assertEqual(
            services.compute_shift_totals(turno)["expected_cash"], Decimal("2500.00")
        )

    def test_rechazo_exige_motivo_y_no_mueve_efectivo(self) -> None:
        self._abrir_turno("5000.00")
        gasto = services.register_expense(
            amount=Decimal("2500.00"), description="Bomba de agua", actor=self.cajero
        )

        with self.assertRaises(DomainError):
            services.review_expense(expense_id=gasto.pk, approve=False, actor=self.gerente)

        services.review_expense(
            expense_id=gasto.pk, approve=False, notes="Cotizacion muy alta", actor=self.gerente
        )
        gasto.refresh_from_db()
        self.assertEqual(gasto.status, ExpenseStatus.REJECTED)
        self.assertFalse(CashMovement.objects.filter(expense=gasto).exists())

    def test_gasto_pendiente_bloquea_el_cierre_del_turno(self) -> None:
        turno = self._abrir_turno("5000.00")
        services.register_expense(
            amount=Decimal("2500.00"), description="Bomba de agua", actor=self.cajero
        )

        with self.assertRaises(DomainError):
            services.close_shift(
                shift_id=turno.pk, declared_cash=Decimal("5000.00"), actor=self.cajero
            )


@override_settings(PRINTER_BACKEND="dummy")
class ReceiptTests(FinancesTestCase):
    def test_cerrar_la_cuenta_emite_el_ticket(self) -> None:
        self._abrir_turno()
        self._renta_cobrada()

        recibo = Receipt.objects.get(folio__isnull=False)
        self.assertFalse(recibo.is_reprint)
        self.assertEqual(recibo.payload["total"], "300.00")
        self.assertIn("TOTAL", render(recibo))

    def test_el_ticket_conserva_el_desglose_de_la_cuenta(self) -> None:
        self._abrir_turno()
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.cajero
        )
        sales_services.register_payment(
            folio_id=stay.folio.pk,
            method=PaymentMethod.CASH,
            amount=Decimal("300.00"),
            tendered_amount=Decimal("500.00"),
            actor=self.cajero,
        )
        recibo = create_folio_receipt(folio=stay.folio, actor=self.cajero)
        texto = render_folio_ticket(recibo.payload)

        self.assertIn(self.room.number, texto)
        self.assertIn("Cambio", texto)
        self.assertIn("200.00", texto)

    def test_ticket_de_corte_de_turno(self) -> None:
        turno = self._abrir_turno()
        self._renta_cobrada()
        cerrado = services.close_shift(
            shift_id=turno.pk, declared_cash=Decimal("800.00"), actor=self.cajero
        )

        recibo = create_shift_receipt(shift=cerrado, actor=self.gerente)
        texto = render_shift_ticket(recibo.payload)

        self.assertIn("CORTE DE TURNO", texto)
        self.assertIn(cerrado.code, texto)
        self.assertIn("Efectivo declarado", texto)


SHIFTS_URL = "/api/v1/finances/shifts/"
EXPENSES_URL = "/api/v1/finances/expenses/"
MOVEMENTS_URL = "/api/v1/finances/cash-movements/"
PAYMENTS_URL = "/api/v1/sales/payments/"


class MoneyReadScopeTests(TestCase):
    """Un empleado no lee la caja del de al lado, ni la del dueño.

    Las cifras de un turno ajeno -- lo esperado, lo declarado y la diferencia
    -- son información de quien manda, no del compañero.
    """

    @classmethod
    def setUpTestData(cls) -> None:
        cls.motel = Motel.objects.create(name="Motel de Caja")
        cls.gerente = User.objects.create_user(
            username="gerencia.caja", password="Demo.1234", full_name="Gerencia",
            role=Role.MANAGER, motel=cls.motel,
        )
        cls.recepcion = User.objects.create_user(
            username="recepcion.caja", password="Demo.1234", full_name="Recepción",
            role=Role.RECEPTION, motel=cls.motel,
        )
        cls.limpieza = User.objects.create_user(
            username="limpieza.caja", password="Demo.1234", full_name="Limpieza",
            role=Role.HOUSEKEEPING, motel=cls.motel,
        )
        with use_motel(cls.motel):
            cls.turno_gerente = services.open_shift(
                cashier=cls.gerente, opening_balance=Decimal("500.00")
            )
            cls.turno_recepcion = services.open_shift(
                cashier=cls.recepcion, opening_balance=Decimal("300.00")
            )
            cls.gasto_gerente = services.register_expense(
                amount=Decimal("120.00"), description="Compra de gerencia",
                actor=cls.gerente, shift_id=cls.turno_gerente.pk,
            )
            cls.gasto_recepcion = services.register_expense(
                amount=Decimal("80.00"), description="Compra de recepción",
                actor=cls.recepcion, shift_id=cls.turno_recepcion.pk,
            )

    def auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_recepcion_solo_ve_su_propio_turno(self) -> None:
        response = self.auth(self.recepcion).get(SHIFTS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [fila["code"] for fila in response.data["results"]], [self.turno_recepcion.code]
        )

    def test_gerencia_sigue_viendo_los_turnos_de_todos(self) -> None:
        response = self.auth(self.gerente).get(SHIFTS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {fila["code"] for fila in response.data["results"]},
            {self.turno_recepcion.code, self.turno_gerente.code},
        )

    def test_recepcion_solo_ve_sus_propios_gastos(self) -> None:
        response = self.auth(self.recepcion).get(EXPENSES_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [fila["folio"] for fila in response.data["results"]], [self.gasto_recepcion.folio]
        )

    def test_recepcion_no_ve_el_efectivo_del_turno_ajeno(self) -> None:
        response = self.auth(self.recepcion).get(MOVEMENTS_URL)

        self.assertEqual(response.status_code, 200)
        turnos = {fila["shift"] for fila in response.data["results"]}
        self.assertNotIn(self.turno_gerente.pk, turnos)
        self.assertIn(self.turno_recepcion.pk, turnos)

    def test_el_arqueo_de_otro_cajero_no_se_consulta(self) -> None:
        url = f"{SHIFTS_URL}{self.turno_gerente.pk}/cash-counts/"

        self.assertEqual(self.auth(self.recepcion).get(url).status_code, 404)
        self.assertEqual(self.auth(self.gerente).get(url).status_code, 200)

    def test_ama_de_llaves_no_lee_nada_de_dinero(self) -> None:
        cliente = self.auth(self.limpieza)

        for url in (SHIFTS_URL, EXPENSES_URL, MOVEMENTS_URL, PAYMENTS_URL):
            with self.subTest(url=url):
                self.assertEqual(cliente.get(url).status_code, 403)

    def test_recepcion_conserva_la_consulta_de_pagos(self) -> None:
        self.assertEqual(self.auth(self.recepcion).get(PAYMENTS_URL).status_code, 200)
