"""Pruebas de tiempo real y tareas periódicas (Fase 3)."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from apps.finances.services import open_shift
from apps.inventory.models import Product, ProductCategory, StockLot, Warehouse, WarehouseStock
from apps.inventory.tasks import check_expiring_lots, check_low_stock
from apps.notifications.events import Event, frontdesk_group
from apps.notifications.models import Notification, NotificationCategory, NotificationLevel
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, Stay, TariffBlock
from apps.rooms.tasks import sweep_stay_timers
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class RealtimeEventTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.motel = Motel.objects.create(name="Motel Tiempo Real")
        cls.other_motel = Motel.objects.create(name="Motel Vecino")
        cls.user = User.objects.create_user(
            username="recepcion2", password="Demo.1234", full_name="Beto Recepción",
            role=Role.RECEPTION, motel=cls.motel,
        )
        with use_motel(cls.motel):
            cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
            cls.room = Room.objects.create(number="301", room_type=cls.room_type)
            cls.block = TariffBlock.objects.create(
                room_type=cls.room_type,
                name="4 horas",
                duration_minutes=240,
                base_price=Decimal("300.00"),
            )
            cls.shift = open_shift(cashier=cls.user, opening_balance=Decimal("500.00"))

    def _subscribe(self, group: str) -> str:
        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(group, channel)
        return channel

    def _drain(self, channel: str, limit: int = 20) -> list[dict]:
        """Vacia la cola del canal. ``receive`` espera indefinidamente, así que
        se corta con un timeout corto cuando ya no queda nada."""
        layer = get_channel_layer()

        async def _receive_all() -> list[dict]:
            mensajes: list[dict] = []
            while len(mensajes) < limit:
                try:
                    mensajes.append(await asyncio.wait_for(layer.receive(channel), 0.1))
                except asyncio.TimeoutError:
                    break
            return mensajes

        return async_to_sync(_receive_all)()

    def test_rentar_emite_eventos_al_grid_despues_del_commit(self) -> None:
        channel = self._subscribe(frontdesk_group(self.motel))

        with use_motel(self.motel):
            with self.captureOnCommitCallbacks(execute=True):
                stay = frontdesk.rent_room(
                    room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
                )

        eventos = [m["event"] for m in self._drain(channel)]
        self.assertIn(Event.ROOM_STATUS_CHANGED, eventos)
        self.assertIn(Event.STAY_STARTED, eventos)
        self.assertEqual(stay.room.status, "OCCUPIED")

    def test_no_se_emite_nada_si_la_transaccion_falla(self) -> None:
        channel = self._subscribe(frontdesk_group(self.motel))

        with use_motel(self.motel):
            with self.captureOnCommitCallbacks(execute=True):
                frontdesk.rent_room(
                    room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
                )
        self._drain(channel)

        with use_motel(self.motel):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(Exception):
                    frontdesk.rent_room(
                        room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
                    )

        self.assertEqual(self._drain(channel), [])

    def test_checkout_emite_limpieza(self) -> None:
        with use_motel(self.motel):
            stay = frontdesk.rent_room(
                room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
            )
        channel = self._subscribe(frontdesk_group(self.motel))

        with use_motel(self.motel):
            with self.captureOnCommitCallbacks(execute=True):
                frontdesk.checkout_stay(
                    stay_id=stay.pk,
                    actor=self.user,
                    payments=[{"method": "CASH", "amount": Decimal("300.00")}],
                )

        eventos = [m["event"] for m in self._drain(channel)]
        self.assertIn(Event.STAY_CLOSED, eventos)
        self.assertIn(Event.CLEANING_TASK, eventos)

    def test_un_motel_no_recibe_eventos_del_vecino(self) -> None:
        propio = self._subscribe(frontdesk_group(self.motel))
        vecino = self._subscribe(frontdesk_group(self.other_motel))

        with use_motel(self.motel):
            with self.captureOnCommitCallbacks(execute=True):
                frontdesk.rent_room(
                    room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
                )

        self.assertTrue(self._drain(propio))
        self.assertEqual(self._drain(vecino), [])


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class StayTimerTaskTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.motel = Motel.objects.create(name="Motel Cronómetros")
        cls.user = User.objects.create_user(
            username="recepcion3", password="Demo.1234", full_name="Cris Recepción",
            role=Role.RECEPTION, motel=cls.motel,
        )
        with use_motel(cls.motel):
            cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
            cls.room = Room.objects.create(number="401", room_type=cls.room_type)
            cls.block = TariffBlock.objects.create(
                room_type=cls.room_type,
                name="4 horas",
                duration_minutes=240,
                base_price=Decimal("300.00"),
            )

    def _rent(self) -> Stay:
        with use_motel(self.motel):
            return frontdesk.rent_room(
                room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.user
            )

    def test_avisa_una_sola_vez_por_vencimiento_proximo(self) -> None:
        stay = self._rent()
        Stay.objects.filter(pk=stay.pk).update(
            expires_at=timezone.now() + timedelta(minutes=5)
        )

        resultado = sweep_stay_timers(self.motel.pk)
        self.assertEqual(resultado["warned"], 1)

        stay.refresh_from_db()
        self.assertIsNotNone(stay.warning_notified_at)
        self.assertTrue(
            Notification.objects.filter(
                category=NotificationCategory.STAY_EXPIRING, level=NotificationLevel.WARNING
            ).exists()
        )

        self.assertEqual(sweep_stay_timers(self.motel.pk)["warned"], 0)

    def test_renta_vencida_genera_aviso_critico(self) -> None:
        stay = self._rent()
        ahora = timezone.now()
        Stay.objects.filter(pk=stay.pk).update(
            check_in_at=ahora - timedelta(hours=5), expires_at=ahora - timedelta(minutes=1)
        )

        resultado = sweep_stay_timers(self.motel.pk)
        self.assertEqual(resultado["expired"], 1)

        stay.refresh_from_db()
        self.assertIsNotNone(stay.expired_notified_at)
        self.assertTrue(
            Notification.objects.filter(
                category=NotificationCategory.STAY_EXPIRED, level=NotificationLevel.CRITICAL
            ).exists()
        )
        self.assertEqual(sweep_stay_timers(self.motel.pk)["expired"], 0)

    def test_extender_reinicia_los_avisos(self) -> None:
        stay = self._rent()
        Stay.objects.filter(pk=stay.pk).update(
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        sweep_stay_timers(self.motel.pk)

        with use_motel(self.motel):
            frontdesk.extend_stay(
                stay_id=stay.pk, actor=self.user, minutes=120, price=Decimal("150.00")
            )
        stay.refresh_from_db()
        self.assertIsNone(stay.warning_notified_at)


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class InventoryTaskTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.motel = Motel.objects.create(name="Motel Inventario")
        with use_motel(cls.motel):
            cls.warehouse = Warehouse.objects.create(code="ALM", name="Almacén general")
            cls.category = ProductCategory.objects.create(name="Refrescos")
            cls.product = Product.objects.create(
                sku="REF-600", name="Refresco 600 ml", category=cls.category,
                sale_price=Decimal("35.00"),
            )

    def test_alerta_de_stock_minimo_no_se_repite_de_inmediato(self) -> None:
        WarehouseStock.objects.create(
            motel=self.motel,
            product=self.product,
            warehouse=self.warehouse,
            quantity=Decimal("2.000"),
            min_stock=Decimal("10.000"),
        )

        self.assertEqual(check_low_stock(self.motel.pk), 1)
        self.assertTrue(
            Notification.objects.filter(category=NotificationCategory.LOW_STOCK).exists()
        )
        self.assertEqual(check_low_stock(self.motel.pk), 0)

    def test_stock_por_encima_del_minimo_no_alerta(self) -> None:
        WarehouseStock.objects.create(
            motel=self.motel,
            product=self.product,
            warehouse=self.warehouse,
            quantity=Decimal("50.000"),
            min_stock=Decimal("10.000"),
        )
        self.assertEqual(check_low_stock(self.motel.pk), 0)

    def test_tarea_de_inventario_no_procesa_otro_motel(self) -> None:
        other_motel = Motel.objects.create(name="Motel Inventario Vecino")
        with use_motel(other_motel):
            warehouse = Warehouse.objects.create(code="ALM", name="Almacén vecino")
            category = ProductCategory.objects.create(name="Bebidas vecinas")
            product = Product.objects.create(
                sku="VEC-001",
                name="Producto vecino",
                category=category,
                sale_price=Decimal("20.00"),
            )
            other_stock = WarehouseStock.objects.create(
                product=product,
                warehouse=warehouse,
                quantity=Decimal("1.000"),
                min_stock=Decimal("5.000"),
            )

        self.assertEqual(check_low_stock(self.motel.pk), 0)
        other_stock.refresh_from_db()
        self.assertIsNone(other_stock.low_stock_notified_at)
        self.assertFalse(
            Notification.all_objects.filter(
                motel=other_motel,
                category=NotificationCategory.LOW_STOCK,
            ).exists()
        )

    def test_lote_por_caducar_genera_alerta(self) -> None:
        StockLot.objects.create(
            motel=self.motel,
            product=self.product,
            warehouse=self.warehouse,
            lot_code="L-001",
            expiration_date=timezone.localdate() + timedelta(days=3),
            quantity=Decimal("12.000"),
        )
        self.assertEqual(check_expiring_lots(self.motel.pk), 1)
        notificacion = Notification.objects.get(category=NotificationCategory.EXPIRING_LOT)
        self.assertEqual(notificacion.level, NotificationLevel.WARNING)
        self.assertEqual(check_expiring_lots(self.motel.pk), 0)

    def test_lote_ya_caducado_es_critico(self) -> None:
        StockLot.objects.create(
            motel=self.motel,
            product=self.product,
            warehouse=self.warehouse,
            lot_code="L-002",
            expiration_date=timezone.localdate() - timedelta(days=1),
            quantity=Decimal("4.000"),
        )
        check_expiring_lots(self.motel.pk)
        notificacion = Notification.objects.get(category=NotificationCategory.EXPIRING_LOT)
        self.assertEqual(notificacion.level, NotificationLevel.CRITICAL)


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ConsumerAuthTests(TransactionTestCase):
    """El WebSocket exige JWT: sin token no hay grid ni notificaciones."""

    def _application(self):
        from channels.routing import URLRouter

        from apps.notifications.middleware import JWTAuthMiddlewareStack
        from core.routing import websocket_urlpatterns

        return JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))

    async def test_conexion_sin_token_es_rechazada(self) -> None:
        communicator = WebsocketCommunicator(self._application(), "/ws/frontdesk/")
        connected, code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)
        await communicator.disconnect()

    async def test_conexion_con_token_valido_recibe_handshake(self) -> None:
        from channels.db import database_sync_to_async
        from rest_framework_simplejwt.tokens import AccessToken

        motel = await database_sync_to_async(Motel.objects.create)(name="Motel WebSocket")
        user = await database_sync_to_async(User.objects.create_user)(
            username="ws.user", password="Demo.1234", full_name="Usuario WS",
            role=Role.RECEPTION, motel=motel,
        )
        token = await database_sync_to_async(lambda: str(AccessToken.for_user(user)))()

        communicator = WebsocketCommunicator(
            self._application(), f"/ws/frontdesk/?token={token}"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        mensaje = await communicator.receive_json_from()
        self.assertEqual(mensaje["event"], "connection.ready")
        self.assertEqual(mensaje["payload"]["role"], Role.RECEPTION)
        self.assertIn(frontdesk_group(motel.pk), mensaje["payload"]["groups"])
        await communicator.disconnect()
