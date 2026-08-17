"""Pruebas de folio, consumos e integración con inventario (Fase 2)."""

from __future__ import annotations

from decimal import Decimal

from django.test import TestCase

from common.exceptions import DomainError, InsufficientStock

from apps.inventory.constants import MovementType, ProductKind, WarehouseType
from apps.inventory.models import Product, ProductCategory, StockMovement, Warehouse, WarehouseStock
from apps.finances.services import open_shift
from apps.inventory.services import register_entry
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.sales import services
from apps.sales.constants import ChargeType, FolioStatus, OrderStatus, PaymentMethod
from apps.users.constants import Role
from apps.users.models import User


class SalesTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.user = User.objects.create_user(
            username="caja1", password="Demo.1234", full_name="Luis Caja", role=Role.RECEPTION
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
        # El Kardex conserva la venta y suma la reversa: nada se borro.
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
