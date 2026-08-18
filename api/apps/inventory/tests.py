"""Pruebas del motor de inventario y del Kardex (Fase 4)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from common.exceptions import DomainError, ImmutableRecordError, InsufficientStock

from apps.inventory import services
from apps.inventory.constants import MovementType, ProductKind, PurchaseStatus, WarehouseType
from apps.inventory.models import (
    Product,
    ProductCategory,
    PurchaseOrder,
    PurchaseOrderItem,
    StockLot,
    StockMovement,
    Warehouse,
    WarehouseStock,
    Supplier,
)
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel


class InventoryTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.user = User.objects.create_user(
            username="almacen1", password="Demo.1234", full_name="Rosa Almacén",
            role=Role.MANAGER,
        )
        cls.almacen = Warehouse.objects.create(code="GEN", name="General")
        cls.bar = Warehouse.objects.create(
            code="BAR", name="Bar", warehouse_type=WarehouseType.BAR
        )
        cls.categoria = ProductCategory.objects.create(
            name="Botanas", kind=ProductKind.FOOD
        )
        cls.producto = Product.objects.create(
            sku="BOT-001", name="Cacahuates", category=cls.categoria, sale_price=Decimal("30.00")
        )
        cls.perecedero = Product.objects.create(
            sku="LEC-001",
            name="Leche 1 L",
            category=cls.categoria,
            sale_price=Decimal("28.00"),
            track_expiration=True,
        )


class MovementTests(InventoryTestCase):
    def test_entrada_suma_existencia_y_asienta_saldo(self) -> None:
        movimiento = services.register_entry(
            product=self.producto,
            warehouse=self.almacen,
            quantity=Decimal("10"),
            unit_cost=Decimal("12.50"),
            actor=self.user,
        )
        stock = WarehouseStock.objects.get(product=self.producto, warehouse=self.almacen)

        self.assertEqual(stock.quantity, Decimal("10.000"))
        self.assertEqual(movimiento.balance_after, Decimal("10.000"))
        self.assertEqual(movimiento.signed_quantity, Decimal("10.000"))
        self.assertTrue(movimiento.is_inbound)

    def test_costo_promedio_ponderado(self) -> None:
        services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("10"),
            unit_cost=Decimal("10.00"), actor=self.user,
        )
        services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("10"),
            unit_cost=Decimal("20.00"), actor=self.user,
        )
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.average_cost, Decimal("15.0000"))
        self.assertEqual(self.producto.last_cost, Decimal("20.0000"))

    def test_salida_sin_existencia_es_rechazada(self) -> None:
        with self.assertRaises(InsufficientStock):
            services.register_exit(
                product=self.producto,
                warehouse=self.almacen,
                quantity=Decimal("1"),
                actor=self.user,
            )

    def test_kardex_es_inmutable(self) -> None:
        movimiento = services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("5"),
            unit_cost=Decimal("10.00"), actor=self.user,
        )
        movimiento.quantity = Decimal("999")
        with self.assertRaises(ImmutableRecordError):
            movimiento.save()
        with self.assertRaises(ImmutableRecordError):
            movimiento.delete()


class WasteTests(InventoryTestCase):
    def setUp(self) -> None:
        services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("20"),
            unit_cost=Decimal("10.00"), actor=self.user,
        )

    def test_merma_descuenta_y_exige_motivo(self) -> None:
        with self.assertRaises(DomainError):
            services.register_waste(
                product=self.producto, warehouse=self.almacen, quantity=Decimal("2"),
                reason="", actor=self.user,
            )

        services.register_waste(
            product=self.producto,
            warehouse=self.almacen,
            quantity=Decimal("2"),
            reason="Producto derramado",
            actor=self.user,
        )
        stock = WarehouseStock.objects.get(product=self.producto, warehouse=self.almacen)
        self.assertEqual(stock.quantity, Decimal("18.000"))
        self.assertTrue(
            StockMovement.objects.filter(movement_type=MovementType.WASTE).exists()
        )


class TransferTests(InventoryTestCase):
    def setUp(self) -> None:
        services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("30"),
            unit_cost=Decimal("10.00"), actor=self.user,
        )

    def test_traspaso_mueve_existencia_entre_almacenes(self) -> None:
        services.transfer_stock(
            product=self.producto,
            source_warehouse=self.almacen,
            target_warehouse=self.bar,
            quantity=Decimal("12"),
            actor=self.user,
        )
        origen = WarehouseStock.objects.get(product=self.producto, warehouse=self.almacen)
        destino = WarehouseStock.objects.get(product=self.producto, warehouse=self.bar)

        self.assertEqual(origen.quantity, Decimal("18.000"))
        self.assertEqual(destino.quantity, Decimal("12.000"))

    def test_traspaso_al_mismo_almacen_es_rechazado(self) -> None:
        with self.assertRaises(DomainError):
            services.transfer_stock(
                product=self.producto,
                source_warehouse=self.almacen,
                target_warehouse=self.almacen,
                quantity=Decimal("1"),
                actor=self.user,
            )

    def test_traspaso_sin_existencia_no_deja_saldo_a_medias(self) -> None:
        with self.assertRaises(InsufficientStock):
            services.transfer_stock(
                product=self.producto,
                source_warehouse=self.almacen,
                target_warehouse=self.bar,
                quantity=Decimal("500"),
                actor=self.user,
            )
        self.assertFalse(
            WarehouseStock.objects.filter(
                product=self.producto, warehouse=self.bar, quantity__gt=0
            ).exists()
        )


class AdjustmentTests(InventoryTestCase):
    def setUp(self) -> None:
        services.register_entry(
            product=self.producto, warehouse=self.almacen, quantity=Decimal("40"),
            unit_cost=Decimal("10.00"), actor=self.user,
        )

    def test_conteo_menor_genera_ajuste_negativo(self) -> None:
        movimiento = services.adjust_stock(
            product=self.producto,
            warehouse=self.almacen,
            counted_quantity=Decimal("37"),
            reason="Conteo mensual",
            actor=self.user,
        )
        self.assertEqual(movimiento.movement_type, MovementType.ADJUSTMENT_OUT)
        self.assertEqual(movimiento.quantity, Decimal("3.000"))
        self.assertEqual(movimiento.balance_after, Decimal("37.000"))

    def test_conteo_igual_no_genera_movimiento(self) -> None:
        self.assertIsNone(
            services.adjust_stock(
                product=self.producto,
                warehouse=self.almacen,
                counted_quantity=Decimal("40"),
                reason="Conteo mensual",
                actor=self.user,
            )
        )


class LotTests(InventoryTestCase):
    def test_las_salidas_consumen_primero_el_lote_que_vence_antes(self) -> None:
        hoy = timezone.localdate()
        services.register_entry(
            product=self.perecedero, warehouse=self.almacen, quantity=Decimal("6"),
            unit_cost=Decimal("15.00"), lot_code="TARDE",
            expiration_date=hoy + timedelta(days=30), actor=self.user,
        )
        services.register_entry(
            product=self.perecedero, warehouse=self.almacen, quantity=Decimal("4"),
            unit_cost=Decimal("15.00"), lot_code="PRONTO",
            expiration_date=hoy + timedelta(days=2), actor=self.user,
        )

        services.register_exit(
            product=self.perecedero,
            warehouse=self.almacen,
            quantity=Decimal("5"),
            actor=self.user,
        )

        pronto = StockLot.objects.get(lot_code="PRONTO")
        tarde = StockLot.objects.get(lot_code="TARDE")
        self.assertEqual(pronto.quantity, Decimal("0.000"))
        self.assertEqual(tarde.quantity, Decimal("5.000"))

    def test_salida_mayor_a_los_lotes_disponibles_falla(self) -> None:
        services.register_entry(
            product=self.perecedero, warehouse=self.almacen, quantity=Decimal("3"),
            unit_cost=Decimal("15.00"), lot_code="UNICO",
            expiration_date=timezone.localdate() + timedelta(days=5), actor=self.user,
        )
        with self.assertRaises(InsufficientStock):
            services.register_exit(
                product=self.perecedero,
                warehouse=self.almacen,
                quantity=Decimal("10"),
                actor=self.user,
            )


class PurchaseTests(InventoryTestCase):
    def setUp(self) -> None:
        self.supplier = Supplier.objects.create(code="PROV-01", business_name="Proveedor Uno")
        self.order = PurchaseOrder.objects.create(
            folio="OC-00001",
            supplier=self.supplier,
            warehouse=self.almacen,
            status=PurchaseStatus.ORDERED,
            subtotal=Decimal("100.00"),
            total=Decimal("116.00"),
        )
        self.item = PurchaseOrderItem.objects.create(
            order=self.order,
            product=self.producto,
            quantity=Decimal("10"),
            unit_cost=Decimal("10"),
            tax_rate=Decimal("0.16"),
        )

    def test_recepcion_parcial_y_total_actualiza_kardex(self) -> None:
        services.receive_purchase(
            order=self.order,
            receipts=[{"item_id": self.item.id, "quantity": Decimal("4")}],
            actor=self.user,
        )
        self.order.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.order.status, PurchaseStatus.PARTIAL)
        self.assertEqual(self.item.received_quantity, Decimal("4.000"))

        services.receive_purchase(
            order=self.order,
            receipts=[{"item_id": self.item.id, "quantity": Decimal("6")}],
            actor=self.user,
        )
        self.order.refresh_from_db()
        stock = WarehouseStock.objects.get(product=self.producto, warehouse=self.almacen)
        self.assertEqual(self.order.status, PurchaseStatus.RECEIVED)
        self.assertIsNotNone(self.order.received_at)
        self.assertEqual(stock.quantity, Decimal("10.000"))
        self.assertEqual(len(services.movements_for(self.order)), 2)

    def test_no_permite_recibir_mas_de_lo_solicitado(self) -> None:
        with self.assertRaises(DomainError):
            services.receive_purchase(
                order=self.order,
                receipts=[{"item_id": self.item.id, "quantity": Decimal("11")}],
                actor=self.user,
            )
        self.item.refresh_from_db()
        self.assertEqual(self.item.received_quantity, Decimal("0.000"))
        self.assertFalse(WarehouseStock.objects.filter(product=self.producto).exists())

    def test_producto_perecedero_exige_caducidad(self) -> None:
        perishable_item = PurchaseOrderItem.objects.create(
            order=self.order,
            product=self.perecedero,
            quantity=Decimal("2"),
            unit_cost=Decimal("15"),
        )
        with self.assertRaises(DomainError):
            services.receive_purchase(
                order=self.order,
                receipts=[{"item_id": perishable_item.id, "quantity": Decimal("1")}],
                actor=self.user,
            )


PRODUCTS_URL = "/api/v1/inventory/products/"
KARDEX_URL = "/api/v1/inventory/kardex/"


class CostVisibilityTests(TestCase):
    """El costo y el margen son del dueño; el catálogo es de todos.

    Recepción necesita el producto para cargarlo al folio, pero saber en
    cuánto se compró es otra cosa.
    """

    @classmethod
    def setUpTestData(cls) -> None:
        cls.motel = Motel.objects.create(name="Motel de Almacén")
        cls.gerente = User.objects.create_user(
            username="gerencia.almacen", password="Demo.1234", full_name="Gerencia",
            role=Role.MANAGER, motel=cls.motel,
        )
        cls.recepcion = User.objects.create_user(
            username="recepcion.almacen", password="Demo.1234", full_name="Recepción",
            role=Role.RECEPTION, motel=cls.motel,
        )
        with use_motel(cls.motel):
            cls.almacen = Warehouse.objects.create(code="GEN", name="General")
            cls.categoria = ProductCategory.objects.create(
                name="Botanas", kind=ProductKind.FOOD
            )
            cls.producto = Product.objects.create(
                sku="BOT-100", name="Cacahuates", category=cls.categoria,
                sale_price=Decimal("30.00"),
            )
            services.register_entry(
                product=cls.producto,
                warehouse=cls.almacen,
                quantity=Decimal("10"),
                unit_cost=Decimal("12.50"),
                actor=cls.gerente,
            )

    def auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_gerencia_ve_el_costo_del_producto(self) -> None:
        response = self.auth(self.gerente).get(PRODUCTS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertIn("average_cost", response.data["results"][0])

    def test_recepcion_ve_el_producto_pero_no_su_costo(self) -> None:
        response = self.auth(self.recepcion).get(PRODUCTS_URL)

        self.assertEqual(response.status_code, 200)
        fila = response.data["results"][0]
        self.assertEqual(fila["sku"], "BOT-100")
        self.assertNotIn("average_cost", fila)
        self.assertNotIn("last_cost", fila)

    def test_el_kardex_tampoco_delata_el_costo(self) -> None:
        response = self.auth(self.recepcion).get(KARDEX_URL)

        self.assertEqual(response.status_code, 200)
        fila = response.data["results"][0]
        self.assertNotIn("unit_cost", fila)
        self.assertNotIn("total_cost", fila)
