"""Pruebas de auditoría y matriz de permisos (Fase 6)."""

from __future__ import annotations

from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.exceptions import ImmutableRecordError

from apps.audit.constants import AuditAction, AuditModule
from apps.audit.models import AuditLog
from apps.finances.services import open_shift
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.sales.constants import PaymentMethod
from apps.users.constants import PermissionCode, Role, permissions_for
from apps.users.models import User

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER, PRINTER_BACKEND="dummy")
class AuditTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.recepcion = User.objects.create_user(
            username="recepcion9", password="Demo.1234", full_name="Nora Recepción",
            role=Role.RECEPTION,
        )
        cls.gerente = User.objects.create_user(
            username="gerente9", password="Demo.1234", full_name="Omar Gerente",
            role=Role.MANAGER,
        )
        cls.limpieza = User.objects.create_user(
            username="limpieza9", password="Demo.1234", full_name="Paty Limpieza",
            role=Role.HOUSEKEEPING,
        )
        cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
        cls.room = Room.objects.create(number="701", room_type=cls.room_type)
        cls.block = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="4 horas",
            duration_minutes=240,
            base_price=Decimal("300.00"),
        )
        cls.shift = open_shift(cashier=cls.recepcion, opening_balance=Decimal("500.00"))


class AuditLogTests(AuditTestCase):
    def test_la_renta_deja_su_renglon_de_negocio(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )

        log = AuditLog.objects.get(action=AuditAction.ROOM_RENTED)
        self.assertEqual(log.actor, self.recepcion)
        self.assertEqual(log.module, AuditModule.ROOMS)
        self.assertIn(stay.code, log.description)
        self.assertEqual(log.extra["room"], self.room.number)
        self.assertEqual(log.extra["base_price"], "300.00")

    def test_el_cambio_de_estado_guarda_antes_y_despues(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )

        log = AuditLog.objects.filter(action=AuditAction.ROOM_STATUS).first()
        self.assertEqual(log.changes["status"]["before"], "AVAILABLE")
        self.assertEqual(log.changes["status"]["after"], "OCCUPIED")

    def test_el_cobro_y_el_cierre_quedan_registrados(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        frontdesk.checkout_stay(
            stay_id=stay.pk,
            actor=self.recepcion,
            payments=[{"method": PaymentMethod.CASH, "amount": Decimal("300.00")}],
        )

        pago = AuditLog.objects.get(action=AuditAction.PAYMENT_REGISTERED)
        cierre = AuditLog.objects.get(action=AuditAction.FOLIO_CLOSED)

        self.assertEqual(pago.extra["amount"], "300.00")
        self.assertEqual(pago.extra["shift"], self.shift.code)
        self.assertEqual(cierre.extra["total"], "300.00")
        self.assertTrue(AuditLog.objects.filter(action=AuditAction.ROOM_CHECKOUT).exists())

    def test_la_cancelacion_conserva_el_motivo(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        frontdesk.cancel_stay(
            stay_id=stay.pk, reason="Se capturo el cuarto equivocado", actor=self.recepcion
        )

        log = AuditLog.objects.get(action=AuditAction.ROOM_CANCELLED)
        self.assertEqual(log.extra["reason"], "Se capturo el cuarto equivocado")

    def test_el_registro_generico_captura_la_modificacion(self) -> None:
        self.room.notes = "Cambiar cortinas"
        self.room.save()

        log = (
            AuditLog.objects.filter(action=AuditAction.UPDATE, object_id=self.room.pk)
            .order_by("-id")
            .first()
        )
        self.assertIn("notes", log.changes)
        self.assertEqual(log.changes["notes"]["after"], "Cambiar cortinas")

    def test_la_baja_logica_se_distingue_de_una_edicion(self) -> None:
        tipo = RoomType.objects.create(name="Temporal", code="TMP")
        tipo.soft_delete(user=self.gerente, reason="Ya no se usa")

        log = AuditLog.objects.filter(
            action=AuditAction.SOFT_DELETE, object_id=tipo.pk
        ).first()
        self.assertIsNotNone(log)
        self.assertFalse(log.changes["is_active"]["after"])

    def test_la_bitacora_es_inmutable(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        log = AuditLog.objects.first()

        log.description = "editado"
        with self.assertRaises(ImmutableRecordError):
            log.save()
        with self.assertRaises(ImmutableRecordError):
            log.delete()

    def test_el_movimiento_de_inventario_se_audita(self) -> None:
        from apps.inventory.models import Product, ProductCategory, Warehouse
        from apps.inventory.services import register_entry

        almacen = Warehouse.objects.create(code="GEN", name="General")
        categoria = ProductCategory.objects.create(name="Bebidas")
        producto = Product.objects.create(
            sku="AGU-001", name="Agua 1 L", category=categoria, sale_price=Decimal("20.00")
        )
        register_entry(
            product=producto,
            warehouse=almacen,
            quantity=Decimal("10"),
            unit_cost=Decimal("8.00"),
            actor=self.gerente,
        )

        log = AuditLog.objects.get(action=AuditAction.STOCK_MOVED)
        self.assertEqual(log.module, AuditModule.INVENTORY)
        self.assertEqual(log.extra["balance_after"], "10.000")


class PermissionMatrixTests(AuditTestCase):
    def test_la_matriz_reparte_los_permisos_esperados(self) -> None:
        recepcion = permissions_for(self.recepcion)
        limpieza = permissions_for(self.limpieza)
        gerente = permissions_for(self.gerente)

        self.assertIn(PermissionCode.ROOM_RENT, recepcion)
        self.assertNotIn(PermissionCode.FOLIO_DISCOUNT, recepcion)
        self.assertNotIn(PermissionCode.EXPENSE_APPROVE, recepcion)
        self.assertNotIn(PermissionCode.AUDIT_VIEW, recepcion)

        self.assertIn(PermissionCode.HOUSEKEEPING_TASK, limpieza)
        self.assertNotIn(PermissionCode.ROOM_RENT, limpieza)
        self.assertNotIn(PermissionCode.PAYMENT_REGISTER, limpieza)

        self.assertIn(PermissionCode.EXPENSE_APPROVE, gerente)
        self.assertIn(PermissionCode.AUDIT_VIEW, gerente)
        self.assertNotIn(PermissionCode.USER_MANAGE, gerente)


@override_settings(
    CHANNEL_LAYERS=IN_MEMORY_LAYER,
    PRINTER_BACKEND="dummy",
    SECURE_SSL_REDIRECT=False,
)
class EndpointPermissionTests(AuditTestCase):
    """Comprueba la matriz sobre la API real, no solo sobre el diccionario."""

    def _client(self, user) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_limpieza_no_puede_rentar(self) -> None:
        respuesta = self._client(self.limpieza).post(
            "/api/v1/frontdesk/stays/rent/",
            {"room_id": self.room.pk, "tariff_block_id": self.block.pk},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data["error"]["code"], "permission_denied")

    def test_recepcion_si_puede_rentar(self) -> None:
        respuesta = self._client(self.recepcion).post(
            "/api/v1/frontdesk/stays/rent/",
            {"room_id": self.room.pk, "tariff_block_id": self.block.pk},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 201)

    def test_recepcion_no_puede_aplicar_descuentos(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        respuesta = self._client(self.recepcion).post(
            f"/api/v1/sales/folios/{stay.folio.pk}/discount/",
            {"amount": "50.00", "reason": "Cliente frecuente"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_gerencia_si_puede_aplicar_descuentos(self) -> None:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        respuesta = self._client(self.gerente).post(
            f"/api/v1/sales/folios/{stay.folio.pk}/discount/",
            {"amount": "50.00", "reason": "Cliente frecuente"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 200)

    def test_recepcion_no_ve_la_bitacora(self) -> None:
        self.assertEqual(
            self._client(self.recepcion).get("/api/v1/audit/logs/").status_code, 403
        )
        self.assertEqual(
            self._client(self.gerente).get("/api/v1/audit/logs/").status_code, 200
        )

    def test_solo_superadmin_administra_usuarios(self) -> None:
        self.assertEqual(self._client(self.gerente).get("/api/v1/auth/users/").status_code, 403)

        superadmin = User.objects.create_user(
            username="root9", password="Demo.1234", full_name="Root", role=Role.SUPERADMIN
        )
        self.assertEqual(self._client(superadmin).get("/api/v1/auth/users/").status_code, 200)

    def test_sin_sesion_no_se_entra(self) -> None:
        self.assertEqual(APIClient().get("/api/v1/frontdesk/rooms/grid/").status_code, 401)

    def test_resumen_de_auditoria_respeta_filtros(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        response = self._client(self.gerente).get(
            "/api/v1/audit/logs/summary/", {"action": AuditAction.ROOM_RENTED}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["action"], AuditAction.ROOM_RENTED)

    def test_exportacion_de_auditoria_entrega_csv_filtrado(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        response = self._client(self.gerente).get(
            "/api/v1/audit/logs/export/", {"action": AuditAction.ROOM_RENTED}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        contenido = response.content.decode("utf-8-sig")
        self.assertIn("Renta de habitación", contenido)
        self.assertNotIn("Apertura de turno", contenido)

    def test_catalogos_de_filtros_incluyen_actores_del_motel(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        response = self._client(self.gerente).get("/api/v1/audit/logs/filters/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            self.recepcion.pk,
            [actor["value"] for actor in response.data["actors"]],
        )
