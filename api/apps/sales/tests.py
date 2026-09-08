"""Pruebas de folio, consumos e integración con inventario (Fase 2)."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError


from common.exceptions import DomainError, InsufficientStock
from common.utils import ZERO

from apps.inventory.constants import MovementType, ProductKind, WarehouseType
from apps.inventory.models import Product, ProductCategory, StockMovement, Warehouse, WarehouseStock
from apps.finances.services import open_shift
from apps.inventory.services import register_entry
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.sales import services
from apps.sales.models import Folio, Payment
from apps.sales.constants import (
    ChargeType,
    FolioStatus,
    FolioType,
    OrderStatus,
    PaymentMethod,
)
from apps.users.constants import Role
from apps.users.models import User
from common.testing import SucursalTestCase


class SalesTestCase(SucursalTestCase):
    motel_nombre = "Sucursal de Ventas"

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = User.objects.create_user(
            username="caja1", password="Demo.1234", full_name="Luis Caja",
            role=Role.RECEPTION, motel=cls.motel,
        )
        cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
        cls.room = Room.objects.create(number="201", room_type=cls.room_type)
        cls.block = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="4 horas",
            duration_minutes=240,
            base_price=Decimal("300.00"),
        )
        cls.warehouse = Warehouse.objects.create(
            code="BAR", name="Bar", warehouse_type=WarehouseType.BAR, is_default_for_sales=True
        )
        cls.category = ProductCategory.objects.create(name="Cervezas", kind=ProductKind.BEVERAGE)
        cls.product = Product.objects.create(
            sku="CERV-355",
            name="Cerveza 355 ml",
            category=cls.category,
            sale_price=Decimal("45.00"),
            tax_rate=Decimal("0.1600"),
        )
        cls.shift = open_shift(cashier=cls.user, opening_balance=Decimal("500.00"))

    def setUp(self) -> None:
        register_entry(
            product=self.product,
            warehouse=self.warehouse,
            quantity=Decimal("24"),
            unit_cost=Decimal("20.00"),
            actor=self.user,
            movement_type=MovementType.PURCHASE,
        )
        self.stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
        )
        self.folio = self.stay.folio


class OrderTests(SalesTestCase):
    def test_consumo_descuenta_inventario_y_carga_al_folio(self) -> None:
        order = services.create_order(
            folio_id=self.folio.pk,
            warehouse_id=self.warehouse.pk,
            items=[{"product_id": self.product.pk, "quantity": Decimal("3")}],
            actor=self.user,
        )

        stock = WarehouseStock.objects.get(product=self.product, warehouse=self.warehouse)
        self.folio.refresh_from_db()

        self.assertEqual(stock.quantity, Decimal("21.000"))
        self.assertEqual(order.total, Decimal("135.00"))
        self.assertEqual(self.folio.total, Decimal("435.00"))
        self.assertEqual(self.folio.charges.filter(charge_type=ChargeType.PRODUCTS).count(), 1)
        self.assertTrue(
            StockMovement.objects.filter(
                product=self.product, movement_type=MovementType.SALE
            ).exists()
        )

    def test_sin_existencias_no_hay_venta_ni_cargo(self) -> None:
        with self.assertRaises(InsufficientStock):
            services.create_order(
                folio_id=self.folio.pk,
                warehouse_id=self.warehouse.pk,
                items=[{"product_id": self.product.pk, "quantity": Decimal("50")}],
                actor=self.user,
            )

        self.folio.refresh_from_db()
        stock = WarehouseStock.objects.get(product=self.product, warehouse=self.warehouse)
        self.assertEqual(stock.quantity, Decimal("24.000"))
        self.assertEqual(self.folio.total, Decimal("300.00"))

    def test_cancelar_renglon_devuelve_inventario_y_ajusta_folio(self) -> None:
        order = services.create_order(
            folio_id=self.folio.pk,
            warehouse_id=self.warehouse.pk,
            items=[{"product_id": self.product.pk, "quantity": Decimal("2")}],
            actor=self.user,
        )
        item = order.items.first()

        services.cancel_order_item(
            item_id=item.pk, reason="El huesped se arrepintio", actor=self.user
        )

        stock = WarehouseStock.objects.get(product=self.product, warehouse=self.warehouse)
        self.folio.refresh_from_db()
        order.refresh_from_db()

        self.assertEqual(stock.quantity, Decimal("24.000"))
        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertEqual(self.folio.total, Decimal("300.00"))
        self.assertEqual(StockMovement.objects.filter(product=self.product).count(), 3)

    def test_cancelar_orden_completa_revierte_todo(self) -> None:
        order = services.create_order(
            folio_id=self.folio.pk,
            warehouse_id=self.warehouse.pk,
            items=[
                {"product_id": self.product.pk, "quantity": Decimal("2")},
                {"product_id": self.product.pk, "quantity": Decimal("1")},
            ],
            actor=self.user,
        )
        services.cancel_order(order_id=order.pk, reason="Orden duplicada", actor=self.user)

        stock = WarehouseStock.objects.get(product=self.product, warehouse=self.warehouse)
        self.folio.refresh_from_db()
        self.assertEqual(stock.quantity, Decimal("24.000"))
        self.assertEqual(self.folio.total, Decimal("300.00"))


class PaymentTests(SalesTestCase):
    def test_pago_mayor_al_saldo_es_rechazado(self) -> None:
        with self.assertRaises(DomainError):
            services.register_payment(
                folio_id=self.folio.pk,
                method=PaymentMethod.CASH,
                amount=Decimal("400.00"),
                tendered_amount=Decimal("400.00"),
                actor=self.user,
            )

    def test_efectivo_insuficiente_es_rechazado(self) -> None:
        with self.assertRaises(DomainError):
            services.register_payment(
                folio_id=self.folio.pk,
                method=PaymentMethod.CASH,
                amount=Decimal("300.00"),
                tendered_amount=Decimal("200.00"),
                actor=self.user,
            )

    def test_pago_parcial_deja_saldo_y_bloquea_cierre(self) -> None:
        services.register_payment(
            folio_id=self.folio.pk,
            method=PaymentMethod.CARD,
            amount=Decimal("100.00"),
            actor=self.user,
        )
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.balance, Decimal("200.00"))

        with self.assertRaises(DomainError):
            services.close_folio(folio_id=self.folio.pk, actor=self.user)

    def test_cancelar_pago_reabre_el_saldo(self) -> None:
        payment = services.register_payment(
            folio_id=self.folio.pk,
            method=PaymentMethod.TRANSFER,
            amount=Decimal("300.00"),
            actor=self.user,
        )
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.balance, Decimal("0.00"))

        services.void_payment(payment_id=payment.pk, reason="Transferencia rechazada", actor=self.user)
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.balance, Decimal("300.00"))


class DiscountTests(SalesTestCase):
    def test_descuento_reduce_total_y_se_refleja_en_descuentos(self) -> None:
        services.apply_discount(
            folio_id=self.folio.pk, amount=Decimal("50.00"), reason="Cliente frecuente",
            actor=self.user,
        )
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.total, Decimal("250.00"))
        self.assertEqual(self.folio.discount_total, Decimal("50.00"))

    def test_descuento_mayor_al_total_es_rechazado(self) -> None:
        with self.assertRaises(DomainError):
            services.apply_discount(
                folio_id=self.folio.pk, amount=Decimal("400.00"), reason="Cortesia total",
                actor=self.user,
            )


class FolioLifecycleTests(SalesTestCase):
    def test_no_se_cargan_consumos_a_folio_cerrado(self) -> None:
        services.register_payment(
            folio_id=self.folio.pk,
            method=PaymentMethod.CASH,
            amount=Decimal("300.00"),
            tendered_amount=Decimal("300.00"),
            actor=self.user,
        )
        services.close_folio(folio_id=self.folio.pk, actor=self.user)
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.status, FolioStatus.CLOSED)

        with self.assertRaises(DomainError):
            services.create_order(
                folio_id=self.folio.pk,
                warehouse_id=self.warehouse.pk,
                items=[{"product_id": self.product.pk, "quantity": Decimal("1")}],
                actor=self.user,
            )


class VentaMostradorTests(SalesTestCase):
    """La venta de mostrador completa, que antes no llegaba a cerrarse."""

    def _items(self, cantidad: str = "2"):
        return [{"product_id": self.product.pk, "quantity": Decimal(cantidad)}]

    def test_la_venta_se_cobra_y_se_cierra_en_una_sola_operacion(self) -> None:
        # La regresión que vigila: `close_folio` rechaza cuentas con ordenes
        # sin entregar, y el mostrador nunca marcaba la entrega. La secuencia
        # de cuatro llamadas moria aqui, despues de haber cobrado.
        folio = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items(),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("100.00"),
            actor=self.user,
        )

        self.assertEqual(folio.status, FolioStatus.CLOSED)
        self.assertEqual(folio.total, Decimal("90.00"))
        self.assertEqual(folio.balance, ZERO)
        self.assertEqual(folio.orders.first().status, OrderStatus.DELIVERED)

    def test_la_misma_clave_no_cobra_dos_veces(self) -> None:
        # Doble clic, o la respuesta que se perdio y el navegador reintenta.
        primera = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items("1"),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("50.00"),
            actor=self.user,
            attempt_key="intento-1",
        )
        segunda = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items("1"),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("50.00"),
            actor=self.user,
            attempt_key="intento-1",
        )

        self.assertEqual(primera.pk, segunda.pk)
        self.assertEqual(Folio.objects.filter(folio_type=FolioType.COUNTER).count(), 1)
        self.assertEqual(Payment.objects.filter(folio=primera).count(), 1)

    def test_el_choque_de_dos_cobros_a_la_vez_devuelve_el_mismo_ticket(self) -> None:
        """El perdedor de la carrera recibe el folio bueno, no un error.

        Reproduce lo que pasa con un doble clic real: la restriccion unica ya
        impedia el cargo doble, pero al segundo se le devolvia el error de base
        de datos. El cajero leia "no se pudo completar la venta" sobre una venta
        que si se hizo, y volvia a cobrar; esa segunda vez si duplicaba.
        """
        primera = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items("1"),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("50.00"),
            actor=self.user,
            attempt_key="carrera",
        )

        # Se simula el choque: la fila ya existe cuando el segundo intenta
        # guardarla, que es exactamente el estado en el que PostgreSQL desbloquea
        # al perdedor.
        with patch.object(
            services, "_cobrar_mostrador", side_effect=IntegrityError("uniq_sale_attempt_key")
        ):
            segunda = services.counter_sale(
                warehouse_id=self.warehouse.pk,
                items=self._items("1"),
                method=PaymentMethod.CASH,
                tendered_amount=Decimal("50.00"),
                actor=self.user,
                attempt_key="carrera",
            )

        self.assertEqual(primera.pk, segunda.pk)
        self.assertEqual(Payment.objects.filter(folio=primera).count(), 1)

    def test_un_choque_sin_clave_si_propaga_el_error(self) -> None:
        """Sin clave no hay ticket que devolver: el error tiene que salir."""
        with patch.object(
            services, "_cobrar_mostrador", side_effect=IntegrityError("otra cosa")
        ):
            with self.assertRaises(IntegrityError):
                services.counter_sale(
                    warehouse_id=self.warehouse.pk,
                    items=self._items("1"),
                    method=PaymentMethod.CASH,
                    tendered_amount=Decimal("50.00"),
                    actor=self.user,
                )

    def test_una_venta_distinta_si_se_cobra(self) -> None:
        """La protección no puede volverse un candado: otra clave, otra venta."""
        primera = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items("1"),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("50.00"),
            actor=self.user,
            attempt_key="intento-1",
        )
        segunda = services.counter_sale(
            warehouse_id=self.warehouse.pk,
            items=self._items("1"),
            method=PaymentMethod.CASH,
            tendered_amount=Decimal("50.00"),
            actor=self.user,
            attempt_key="intento-2",
        )

        self.assertNotEqual(primera.pk, segunda.pk)

    def test_sin_existencias_no_queda_cuenta_abierta_ni_cobro(self) -> None:
        """Lo que justifica que sea una transacción y no cuatro llamadas."""
        antes = Folio.objects.filter(folio_type=FolioType.COUNTER).count()

        with self.assertRaises(InsufficientStock):
            services.counter_sale(
                warehouse_id=self.warehouse.pk,
                items=self._items("999"),
                method=PaymentMethod.CASH,
                tendered_amount=Decimal("99999.00"),
                actor=self.user,
                attempt_key="intento-fallido",
            )

        self.assertEqual(Folio.objects.filter(folio_type=FolioType.COUNTER).count(), antes)
        self.assertFalse(Payment.objects.filter(folio__folio_type=FolioType.COUNTER).exists())


class SalidaConConsumoTests(SalesTestCase):
    def test_una_habitacion_con_consumo_puede_hacer_check_out(self) -> None:
        """El bloqueo que dejaba ocupada para siempre a cualquier habitación
        donde el huésped hubiera comprado algo."""
        services.create_order(
            folio_id=self.folio.pk,
            warehouse_id=self.warehouse.pk,
            items=[{"product_id": self.product.pk, "quantity": Decimal("1")}],
            actor=self.user,
        )
        self.folio.refresh_from_db()
        total = self.folio.total

        stay = frontdesk.checkout_stay(
            stay_id=self.stay.pk,
            actor=self.user,
            payments=[{"method": PaymentMethod.CASH, "amount": total, "tendered_amount": total}],
        )

        self.assertEqual(stay.status, "CLOSED")
        self.folio.refresh_from_db()
        self.assertEqual(self.folio.status, FolioStatus.CLOSED)
