"""Pruebas del motel: su perfil, su alta y su aislamiento (Fases 10 y 11)."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.constants import AuditAction, AuditModule
from apps.audit.models import AuditLog
from apps.rooms.models import Room, RoomType
from apps.settings.constants import PrinterBackend
from apps.settings.models import Motel
from apps.settings.services import create_motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel
from common.utils import business_tz

BUSINESS_URL = "/api/v1/settings/business/"
PUBLIC_URL = "/api/v1/settings/business/public/"
MOTELS_URL = "/api/v1/settings/motels/"
ROOMS_URL = "/api/v1/frontdesk/rooms/"


class MotelTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.arcos = Motel.objects.create(name="Arcos Prueba")
        cls.palmas = Motel.objects.create(name="Palmas Prueba")

        cls.gerente = User.objects.create_user(
            username="gerente10", password="Demo.1234", full_name="Olga Gerente",
            role=Role.MANAGER, motel=cls.arcos,
        )
        cls.recepcion = User.objects.create_user(
            username="recepcion10", password="Demo.1234", full_name="Raúl Recepción",
            role=Role.RECEPTION, motel=cls.arcos,
        )
        cls.vecino = User.objects.create_user(
            username="gerente-palmas", password="Demo.1234", full_name="Pedro Palmas",
            role=Role.SUPERADMIN, motel=cls.palmas,
        )
        cls.plataforma = User.objects.create_superuser(
            username="plataforma", password="Demo.1234", full_name="Soporte"
        )

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    def auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client


class MotelModelTests(MotelTestCase):
    def test_el_identificador_se_arma_solo(self) -> None:
        self.assertEqual(self.arcos.slug, "arcos-prueba")

    def test_dos_moteles_con_el_mismo_nombre_no_chocan(self) -> None:
        otro = Motel.objects.create(name="Arcos Prueba")

        self.assertEqual(otro.slug, "arcos-prueba-2")

    def test_sin_contexto_devuelve_los_valores_del_entorno(self) -> None:
        self.assertIsNotNone(Motel.current().name)

    def test_dentro_de_un_contexto_devuelve_ese_motel(self) -> None:
        with use_motel(self.palmas):
            self.assertEqual(Motel.current().pk, self.palmas.pk)


class IsolationTests(MotelTestCase):
    """Lo importante de todo esto: que un motel no vea al otro."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        with use_motel(cls.arcos):
            tipo_arcos = RoomType.objects.create(name="Sencilla", code="SEN")
            cls.cuarto_arcos = Room.objects.create(number="101", room_type=tipo_arcos)
        with use_motel(cls.palmas):
            tipo_palmas = RoomType.objects.create(name="Suite", code="SUI")
            cls.cuarto_palmas = Room.objects.create(number="901", room_type=tipo_palmas)

    def test_el_registro_hereda_el_motel_de_quien_lo_crea(self) -> None:
        self.assertEqual(self.cuarto_arcos.motel_id, self.arcos.pk)
        self.assertEqual(self.cuarto_palmas.motel_id, self.palmas.pk)

    def test_la_api_solo_lista_las_habitaciones_del_motel_propio(self) -> None:
        response = self.auth(self.recepcion).get(ROOMS_URL)

        numeros = [row["number"] for row in response.data["results"]]
        self.assertEqual(numeros, ["101"])

    def test_el_vecino_ve_las_suyas_y_ninguna_mas(self) -> None:
        response = self.auth(self.vecino).get(ROOMS_URL)

        numeros = [row["number"] for row in response.data["results"]]
        self.assertEqual(numeros, ["901"])

    def test_no_se_puede_abrir_una_habitacion_de_otro_motel(self) -> None:
        response = self.auth(self.vecino).get(f"{ROOMS_URL}{self.cuarto_arcos.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_la_plantilla_de_un_motel_no_se_ve_desde_otro(self) -> None:
        with use_motel(self.palmas):
            usuarios = list(User.objects.values_list("username", flat=True))

        self.assertEqual(usuarios, ["gerente-palmas"])

    def test_los_folios_se_numeran_por_separado_en_cada_motel(self) -> None:
        from common.models import DocumentSequence

        with use_motel(self.arcos):
            primero = DocumentSequence.next_value("TEST", "T", padding=3)
        with use_motel(self.palmas):
            vecino = DocumentSequence.next_value("TEST", "T", padding=3)

        self.assertEqual(primero, "T-001")
        self.assertEqual(vecino, "T-001")


class ProfileReadTests(MotelTestCase):
    def test_el_endpoint_publico_no_pide_sesion(self) -> None:
        response = self.client.get(PUBLIC_URL, {"slug": self.arcos.slug})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Arcos Prueba")

    def test_el_endpoint_publico_no_expone_datos_sensibles(self) -> None:
        Motel.objects.filter(pk=self.arcos.pk).update(
            tax_id="XAXX010101000", printer_host="10.0.0.7"
        )

        response = self.client.get(PUBLIC_URL, {"slug": self.arcos.slug})

        self.assertNotIn("tax_id", response.data)
        self.assertNotIn("printer_host", response.data)
        self.assertNotIn("expense_approval_threshold", response.data)

    def test_sin_identificador_no_revela_ningun_motel(self) -> None:
        response = self.client.get(PUBLIC_URL)

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["name"], "Arcos Prueba")

    def test_el_perfil_completo_exige_sesion(self) -> None:
        self.assertEqual(self.client.get(BUSINESS_URL).status_code, 401)

    def test_cada_quien_lee_el_perfil_de_su_motel(self) -> None:
        propio = self.auth(self.recepcion).get(BUSINESS_URL)
        vecino = self.auth(self.vecino).get(BUSINESS_URL)

        self.assertEqual(propio.data["name"], "Arcos Prueba")
        self.assertEqual(vecino.data["name"], "Palmas Prueba")


class ProfileWriteTests(MotelTestCase):
    def test_recepcion_no_puede_cambiar_la_configuracion(self) -> None:
        response = self.auth(self.recepcion).patch(BUSINESS_URL, {"name": "Motel Pirata"})

        self.assertEqual(response.status_code, 403)

    def test_gerencia_cambia_el_nombre_de_su_motel_y_no_el_del_vecino(self) -> None:
        response = self.auth(self.gerente).patch(BUSINESS_URL, {"name": "Motel Renovado"})

        self.assertEqual(response.status_code, 200)
        self.arcos.refresh_from_db()
        self.palmas.refresh_from_db()
        self.assertEqual(self.arcos.name, "Motel Renovado")
        self.assertEqual(self.palmas.name, "Palmas Prueba")

    def test_el_nombre_no_puede_quedar_vacio(self) -> None:
        response = self.auth(self.gerente).patch(BUSINESS_URL, {"name": "   "})

        self.assertEqual(response.status_code, 400)

    def test_la_moneda_debe_ser_codigo_iso(self) -> None:
        response = self.auth(self.gerente).patch(BUSINESS_URL, {"currency": "pesos"})

        self.assertEqual(response.status_code, 400)

    def test_la_moneda_se_guarda_en_mayusculas(self) -> None:
        response = self.auth(self.gerente).patch(BUSINESS_URL, {"currency": "usd"})

        self.assertEqual(response.status_code, 200)
        self.arcos.refresh_from_db()
        self.assertEqual(self.arcos.currency, "USD")

    def test_la_zona_horaria_invalida_se_rechaza(self) -> None:
        response = self.auth(self.gerente).patch(BUSINESS_URL, {"time_zone": "Marte/Olympus"})

        self.assertEqual(response.status_code, 400)

    def test_la_impresora_de_red_exige_direccion(self) -> None:
        response = self.auth(self.gerente).patch(
            BUSINESS_URL, {"printer_backend": PrinterBackend.NETWORK, "printer_host": ""}
        )

        self.assertEqual(response.status_code, 400)

    def test_el_logotipo_se_guarda_y_devuelve_su_url(self) -> None:
        imagen = SimpleUploadedFile("logo.png", b"imagen-falsa", content_type="image/png")

        response = self.auth(self.gerente).patch(
            BUSINESS_URL, {"logo": imagen}, format="multipart"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["logo_url"].startswith("/"))
        self.arcos.refresh_from_db()
        self.arcos.logo.delete(save=True)

    def test_el_logotipo_rechaza_extensiones_ejecutables(self) -> None:
        archivo = SimpleUploadedFile("logo.svg", b"<svg/>", content_type="image/svg+xml")

        response = self.auth(self.gerente).patch(
            BUSINESS_URL, {"logo": archivo}, format="multipart"
        )

        self.assertEqual(response.status_code, 400)

    def test_el_cambio_queda_en_la_bitacora(self) -> None:
        self.auth(self.gerente).patch(BUSINESS_URL, {"name": "Motel Auditado"})

        log = AuditLog.all_objects.filter(action=AuditAction.UPDATE).order_by("-id").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.module, AuditModule.CONFIG)
        self.assertIn("name", log.changes)


class PlatformTests(MotelTestCase):
    def test_solo_la_plataforma_administra_moteles(self) -> None:
        self.assertEqual(self.auth(self.gerente).get(MOTELS_URL).status_code, 403)
        self.assertEqual(self.auth(self.vecino).get(MOTELS_URL).status_code, 403)
        self.assertEqual(self.auth(self.plataforma).get(MOTELS_URL).status_code, 200)

    def test_la_plataforma_ve_todos_los_moteles(self) -> None:
        response = self.auth(self.plataforma).get(MOTELS_URL)

        nombres = {row["name"] for row in response.data["results"]}
        self.assertIn("Arcos Prueba", nombres)
        self.assertIn("Palmas Prueba", nombres)

    def test_dar_de_alta_un_motel_crea_a_su_dueno(self) -> None:
        response = self.auth(self.plataforma).post(
            MOTELS_URL,
            {
                "name": "Motel Nuevo",
                "owner_username": "dueno.nuevo",
                "owner_full_name": "Dueño Nuevo",
                "owner_password": "Demo.1234",
            },
        )

        self.assertEqual(response.status_code, 201)
        dueno = User.all_objects.get(username="dueno.nuevo")
        self.assertEqual(dueno.role, Role.SUPERADMIN)
        self.assertEqual(dueno.motel.name, "Motel Nuevo")

    def test_el_alta_no_deja_motel_sin_dueno_si_el_usuario_falla(self) -> None:
        antes = Motel.all_objects.count()

        response = self.auth(self.plataforma).post(
            MOTELS_URL,
            {
                "name": "Motel Fallido",
                "owner_username": "recepcion10",
                "owner_full_name": "Repetido",
                "owner_password": "Demo.1234",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Motel.all_objects.count(), antes)

    def test_suspender_un_motel_saca_a_su_gente(self) -> None:
        response = self.auth(self.plataforma).post(f"{MOTELS_URL}{self.palmas.pk}/suspend/")

        self.assertEqual(response.status_code, 200)
        self.palmas.refresh_from_db()
        self.assertFalse(self.palmas.is_active)
        self.assertFalse(User.all_objects.get(pk=self.vecino.pk).is_active)

    def test_el_dueno_de_un_motel_no_puede_administrar_la_plataforma(self) -> None:
        from apps.users.constants import PermissionCode, permissions_for

        self.assertNotIn(PermissionCode.MOTEL_MANAGE, permissions_for(self.vecino))
        self.assertIn(PermissionCode.MOTEL_MANAGE, permissions_for(self.plataforma))


class ConsumersTests(MotelTestCase):
    """Lo que antes salia del .env ahora sale del motel de quien opera."""

    def test_el_ticket_toma_el_nombre_del_motel(self) -> None:
        from apps.finances.services import open_shift
        from apps.sales.printing import build_shift_payload

        with use_motel(self.palmas):
            shift = open_shift(cashier=self.vecino, opening_balance=Decimal("0.00"))
            payload = build_shift_payload(shift)

        self.assertEqual(payload["business_name"], "Palmas Prueba")

    def test_la_zona_horaria_sale_del_motel(self) -> None:
        Motel.objects.filter(pk=self.palmas.pk).update(time_zone="America/Tijuana")

        with use_motel(self.palmas):
            self.assertEqual(str(business_tz()), "America/Tijuana")

    def test_el_umbral_de_gastos_sale_del_motel(self) -> None:
        from apps.finances.services import approval_threshold

        Motel.objects.filter(pk=self.palmas.pk).update(
            expense_approval_threshold=Decimal("250.00")
        )

        with use_motel(self.palmas):
            self.assertEqual(approval_threshold(), Decimal("250.00"))
