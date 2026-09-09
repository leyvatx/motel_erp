"""Pruebas del motel: su perfil, su alta y su aislamiento (Fases 10 y 11)."""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from apps.audit.constants import AuditAction, AuditModule
from apps.audit.models import AuditLog
from apps.rooms import services as frontdesk
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.settings.constants import OperationSize, PrinterBackend
from apps.settings.models import Motel
from apps.settings.serializers import clave_desde_correo
from apps.settings.services import create_motel
from apps.users.constants import Role
from apps.users.models import User
from common.middleware import CurrentRequestMiddleware
from common.tenancy import use_motel, without_motel
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

    def test_consulta_operativa_sin_motel_falla_cerrada(self) -> None:
        request = RequestFactory().get("/")
        request.user = self.plataforma

        count = CurrentRequestMiddleware(lambda current: Room.objects.count())(request)

        self.assertEqual(count, 0)

    def test_acceso_global_interno_debe_ser_explicito(self) -> None:
        request = RequestFactory().get("/")
        request.user = self.plataforma

        def count_all(current):
            with without_motel():
                return Room.objects.count()

        count = CurrentRequestMiddleware(count_all)(request)

        self.assertEqual(count, 2)

    def test_la_plantilla_de_un_motel_no_se_ve_desde_otro(self) -> None:
        with use_motel(self.palmas):
            usuarios = list(User.objects.values_list("username", flat=True))

        self.assertEqual(usuarios, ["gerente-palmas"])

    def test_inactivos_y_restauracion_tambien_respetan_el_motel(self) -> None:
        inactive = User.objects.create_user(
            username="inactivo-arcos",
            password="Demo.1234",
            full_name="Inactivo Arcos",
            role=Role.RECEPTION,
            motel=self.arcos,
        )
        inactive.soft_delete(reason="Prueba")
        client = self.auth(self.vecino)

        listed = client.get("/api/v1/auth/users/", {"include_inactive": "true"})
        restored = client.post(f"/api/v1/auth/users/{inactive.pk}/restore/")

        usernames = [row["username"] for row in listed.data["results"]]
        self.assertNotIn("inactivo-arcos", usernames)
        self.assertEqual(restored.status_code, 404)

    def test_usuario_nuevo_hereda_el_motel_del_dueno(self) -> None:
        response = self.auth(self.vecino).post(
            "/api/v1/auth/users/",
            {
                "username": "nuevo-palmas",
                "full_name": "Nuevo Palmas",
                "role": Role.RECEPTION,
                "password": "Demo.1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            User.all_objects.get(username="nuevo-palmas").motel_id,
            self.palmas.pk,
        )

    def test_no_se_puede_quitar_el_ultimo_superadmin(self) -> None:
        response = self.auth(self.vecino).patch(
            f"/api/v1/auth/users/{self.vecino.pk}/",
            {"role": Role.MANAGER},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.vecino.refresh_from_db()
        self.assertEqual(self.vecino.role, Role.SUPERADMIN)

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
        self.assertIn("brand_primary_color", response.data)
        self.assertIn("login_message", response.data)

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

    def test_la_paleta_se_guarda_por_motel_y_valida_hexadecimal(self) -> None:
        response = self.auth(self.gerente).patch(
            BUSINESS_URL,
            {
                "brand_primary_color": "#7C3AED",
                "brand_sidebar_color": "#111827",
                "default_theme": "dark",
                "border_radius": "rounded",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.arcos.refresh_from_db()
        self.palmas.refresh_from_db()
        self.assertEqual(self.arcos.brand_primary_color, "#7C3AED")
        self.assertEqual(self.arcos.default_theme, "dark")
        self.assertEqual(self.palmas.brand_primary_color, "#3B82F6")

        invalid = self.auth(self.gerente).patch(
            BUSINESS_URL, {"brand_primary_color": "morado"}, format="json"
        )
        self.assertEqual(invalid.status_code, 400)

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

    def test_la_plataforma_no_puede_entrar_a_operacion(self) -> None:
        self.assertEqual(self.auth(self.plataforma).get(ROOMS_URL).status_code, 403)
        self.assertEqual(self.auth(self.plataforma).get(BUSINESS_URL).status_code, 403)

    def test_la_plataforma_conserva_acceso_a_su_perfil(self) -> None:
        response = self.auth(self.plataforma).get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_platform_admin"])

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
                "owner_username": "Dueño Con Espacios",
                "owner_full_name": "Clave inválida",
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


class FolioNumberingTests(MotelTestCase):
    """Dos moteles operando el mismo día emiten folios sin pisarse.

    El consecutivo es por motel, así que ambos sacan el mismo texto. Lo que
    la base tiene que aceptar es justo eso, y seguir rechazando el repetido
    dentro de un mismo motel.
    """

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.rooms: dict[int, list[Room]] = {}
        cls.blocks: dict[int, TariffBlock] = {}
        for motel, numeros in ((cls.arcos, ["101", "102"]), (cls.palmas, ["901"])):
            with use_motel(motel):
                tipo = RoomType.objects.create(name="Sencilla", code="SEN")
                cls.rooms[motel.pk] = [
                    Room.objects.create(number=numero, room_type=tipo) for numero in numeros
                ]
                cls.blocks[motel.pk] = TariffBlock.objects.create(
                    room_type=tipo,
                    name="4 horas",
                    duration_minutes=240,
                    base_price=Decimal("300.00"),
                )

    def _rentar(self, motel, actor, indice: int = 0):
        with use_motel(motel):
            return frontdesk.rent_room(
                room_id=self.rooms[motel.pk][indice].pk,
                tariff_block_id=self.blocks[motel.pk].pk,
                actor=actor,
            )

    def test_el_vecino_puede_rentar_con_el_mismo_folio_el_mismo_dia(self) -> None:
        propia = self._rentar(self.arcos, self.gerente)
        vecina = self._rentar(self.palmas, self.vecino)

        self.assertEqual(propia.code, vecina.code)
        self.assertEqual(propia.folio.code, vecina.folio.code)
        self.assertEqual(propia.motel_id, self.arcos.pk)
        self.assertEqual(vecina.motel_id, self.palmas.pk)

    def test_dentro_del_motel_el_folio_sigue_avanzando(self) -> None:
        primera = self._rentar(self.arcos, self.gerente)
        segunda = self._rentar(self.arcos, self.gerente, indice=1)

        self.assertNotEqual(primera.code, segunda.code)
        self.assertNotEqual(primera.folio.code, segunda.folio.code)


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


REGISTRO_URL = "/api/v1/settings/registro/"


class RegistroPublicoTests(TestCase):
    """Alta de autoservicio: el negocio se crea su acceso y entra de una vez."""

    def setUp(self) -> None:
        # El endpoint está limitado a 5 altas por hora y por IP. Todas las
        # pruebas salen de 127.0.0.1, así que sin limpiar el contador la sexta
        # se estrella contra el throttle en vez de contra lo que mide.
        cache.clear()

    def payload(self, **cambios) -> dict:
        datos = {
            "business_name": "Motel Las Palmas",
            "admin_full_name": "Laura Domínguez",
            "email": "laura.dominguez@laspalmas.mx",
            "username": "laura.dominguez",
            "phone": "667 220 1188",
            "operation_size": OperationSize.HASTA_30,
            "password": "Palmas.2026!seguro",
        }
        datos.update(cambios)
        return datos

    def test_el_registro_crea_sucursal_administrador_y_sesion(self) -> None:
        response = APIClient().post(REGISTRO_URL, self.payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        with without_motel():
            motel = Motel.objects.get(name="Motel Las Palmas")
            owner = User.all_objects.get(motel=motel)

        self.assertEqual(owner.role, Role.SUPERADMIN)
        self.assertEqual(owner.email, "laura.dominguez@laspalmas.mx")
        self.assertEqual(response.data["user"]["id"], owner.pk)

    def test_la_clave_de_empleado_es_la_que_se_pidio_en_el_formulario(self) -> None:
        # Antes se derivaba del correo y la persona la descubria despues, en el
        # correo de bienvenida. Ahora la elige, que es con la que va a entrar.
        response = APIClient().post(
            REGISTRO_URL, self.payload(username="ana.ventas"), format="json"
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user"]["username"], "ana.ventas")

    def test_la_derivacion_desde_el_correo_sigue_para_las_altas_sin_formulario(self) -> None:
        # `clave_desde_correo` ya no la usa este endpoint, pero sigue siendo la
        # regla para dar de alta a alguien sin preguntarle nada.
        self.assertEqual(clave_desde_correo("Ana+Ventas@laspalmas.mx"), "anaventas")
        self.assertEqual(clave_desde_correo("jr@laspalmas.mx"), "admin")

    def test_el_token_sirve_para_operar_de_inmediato(self) -> None:
        """Sin esto el cliente tendría que volver a escribir la contraseña."""
        registro = APIClient().post(REGISTRO_URL, self.payload(), format="json")

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {registro.data['access']}")
        perfil = client.get("/api/v1/auth/me/")

        self.assertEqual(perfil.status_code, 200)
        self.assertEqual(perfil.data["id"], registro.data["user"]["id"])

    def test_dos_negocios_con_el_mismo_nombre_no_chocan(self) -> None:
        primero = APIClient().post(REGISTRO_URL, self.payload(), format="json")
        segundo = APIClient().post(
            REGISTRO_URL,
            self.payload(email="otra@otrolado.mx", username="otra.duena"),
            format="json",
        )

        self.assertEqual(primero.status_code, 201)
        self.assertEqual(segundo.status_code, 201)
        with without_motel():
            self.assertEqual(Motel.objects.filter(name="Motel Las Palmas").count(), 2)

    def test_una_contrasena_debil_se_rechaza(self) -> None:
        response = APIClient().post(REGISTRO_URL, self.payload(password="12345678"), format="json")

        self.assertEqual(response.status_code, 400)
        with without_motel():
            self.assertFalse(Motel.objects.filter(name="Motel Las Palmas").exists())

    def test_la_razon_del_rechazo_viaja_bajo_el_campo_que_fallo(self) -> None:
        """El formulario la pinta debajo del input; sin la llave no sabe cuál."""
        response = APIClient().post(REGISTRO_URL, self.payload(password="12345678"), format="json")

        detalles = response.data["error"]["details"]
        self.assertIn("password", detalles)
        self.assertTrue(any("común" in razon for razon in detalles["password"]))

    def test_la_contrasena_no_puede_ser_el_propio_correo(self) -> None:
        """Sin pasarle el usuario, el validador de similitud no hace nada.

        Es la cuenta con más permisos de la sucursal y la elige alguien a quien
        nadie está viendo: que sea su propio correo es justo lo que hay que
        atajar.
        """
        response = APIClient().post(
            REGISTRO_URL,
            self.payload(email="laura.dominguez@laspalmas.mx", password="laura.dominguez"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["error"]["details"])
        with without_motel():
            self.assertFalse(Motel.objects.filter(name="Motel Las Palmas").exists())

    def test_el_alta_no_deja_a_medias_una_sucursal_sin_dueno(self) -> None:
        """Nombre válido, correo inválido: no debe quedar el motel suelto."""
        response = APIClient().post(REGISTRO_URL, self.payload(email="no-es-correo"), format="json")

        self.assertEqual(response.status_code, 400)
        with without_motel():
            self.assertFalse(Motel.objects.filter(name="Motel Las Palmas").exists())

    def test_con_el_registro_cerrado_contesta_403(self) -> None:
        with self.settings(PUBLIC_SIGNUP_ENABLED=False):
            response = APIClient().post(REGISTRO_URL, self.payload(), format="json")

        self.assertEqual(response.status_code, 403)
        with without_motel():
            self.assertFalse(Motel.objects.filter(name="Motel Las Palmas").exists())

    def test_el_recien_registrado_no_ve_las_sucursales_de_los_demas(self) -> None:
        ajeno = Motel.objects.create(name="Motel de Otro Dueño")
        with use_motel(ajeno):
            RoomType.objects.create(name="Sencilla", code="SEN", max_occupants=2)

        registro = APIClient().post(REGISTRO_URL, self.payload(), format="json")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {registro.data['access']}")

        response = client.get("/api/v1/frontdesk/room-types/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])


class RegistroIdempotenteTests(TestCase):
    """Un reintento no puede dejar al usuario con dos negocios."""

    def setUp(self) -> None:
        cache.clear()

    def payload(self, **cambios) -> dict:
        datos = {
            "business_name": "Hostal La Cañada",
            "admin_full_name": "Efraín Ruiz",
            "email": "efrain@lacanada.mx",
            "username": "efrain",
            "phone": "555 123 4567",
            "operation_size": OperationSize.HASTA_30,
            "password": "Canada.2026!segura",
        }
        datos.update(cambios)
        return datos

    def test_la_misma_clave_de_intento_no_crea_dos_organizaciones(self) -> None:
        # El caso real: se pulsa "Crear cuenta", la respuesta se pierde, y el
        # navegador reintenta con la misma clave.
        cliente = APIClient()
        primera = cliente.post(
            REGISTRO_URL, self.payload(attempt_key="intento-1"), format="json"
        )
        segunda = cliente.post(
            REGISTRO_URL, self.payload(attempt_key="intento-1"), format="json"
        )

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(primera.data["user"]["motel"], segunda.data["user"]["motel"])
        self.assertEqual(Motel.all_objects.filter(name="Hostal La Cañada").count(), 1)

    def test_el_mismo_correo_no_abre_un_segundo_negocio_en_silencio(self) -> None:
        """Sin clave de intento, la defensa es el correo.

        Dos negocios con el mismo correo comparten clave de empleado -- se
        deriva del correo -- y al entrar sin decir la sucursal el sistema no
        sabría a cuál. Mandar a entrar es más útil que duplicar en silencio.
        """
        cliente = APIClient()
        cliente.post(REGISTRO_URL, self.payload(), format="json")
        repetida = cliente.post(
            REGISTRO_URL,
            self.payload(business_name="Otro Hostal", username="efrain2"),
            format="json",
        )

        self.assertEqual(repetida.status_code, 409)
        self.assertEqual(repetida.data["error"]["code"], "email_ya_registrado")
        self.assertEqual(Motel.all_objects.filter(name="Otro Hostal").count(), 0)

    def test_otro_correo_si_puede_dar_de_alta_su_negocio(self) -> None:
        """La protección no puede volverse un candado para quien sí es nuevo."""
        cliente = APIClient()
        cliente.post(REGISTRO_URL, self.payload(), format="json")
        otra = cliente.post(
            REGISTRO_URL,
            self.payload(
                email="rosa@otrositio.mx", business_name="Posada Otra", username="rosa"
            ),
            format="json",
        )

        self.assertEqual(otra.status_code, 201)
        self.assertEqual(Motel.all_objects.filter(name="Posada Otra").count(), 1)


class RegistroB2BTests(TestCase):
    """Los datos con los que el alta perfila al negocio, y sus fronteras."""

    def setUp(self) -> None:
        cache.clear()

    def payload(self, **cambios) -> dict:
        datos = {
            "business_name": "Motel Las Brisas",
            "admin_full_name": "Laura Domínguez",
            "email": "laura@lasbrisas.mx",
            "username": "laura",
            "phone": "664 155 9080",
            "operation_size": OperationSize.HASTA_50,
            "password": "Brisas.2026!clave",
        }
        datos.update(cambios)
        return datos

    def test_el_alta_guarda_telefono_y_tamano_en_el_negocio(self) -> None:
        respuesta = APIClient().post(REGISTRO_URL, self.payload(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        motel = Motel.all_objects.get(name="Motel Las Brisas")
        self.assertEqual(motel.phone, "664 155 9080")
        self.assertEqual(motel.operation_size, OperationSize.HASTA_50)

    def test_la_clave_de_acceso_es_la_que_eligio_el_usuario(self) -> None:
        # Antes se derivaba del correo y la persona la descubria despues.
        APIClient().post(REGISTRO_URL, self.payload(), format="json")

        motel = Motel.all_objects.get(name="Motel Las Brisas")
        propietario = User.all_objects.get(motel=motel)
        self.assertEqual(propietario.username, "laura")
        self.assertEqual(propietario.phone, "664 155 9080")

    def test_un_usuario_ya_tomado_se_dice_en_su_campo(self) -> None:
        cliente = APIClient()
        cliente.post(REGISTRO_URL, self.payload(), format="json")

        repetido = cliente.post(
            REGISTRO_URL,
            self.payload(email="otra@lasbrisas.mx", business_name="Otro"),
            format="json",
        )

        self.assertEqual(repetido.status_code, 400)
        self.assertIn("username", repetido.data["error"]["details"])
        self.assertEqual(Motel.all_objects.filter(name="Otro").count(), 0)

    def test_el_usuario_se_guarda_en_minusculas_y_sin_espacios(self) -> None:
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(username="  Laura.D  "), format="json"
        )

        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["user"]["username"], "laura.d")

    def test_un_usuario_con_caracteres_invalidos_no_pasa(self) -> None:
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(username="laura dominguez"), format="json"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("username", respuesta.data["error"]["details"])

    def test_un_telefono_a_medias_no_pasa(self) -> None:
        respuesta = APIClient().post(REGISTRO_URL, self.payload(phone="664"), format="json")

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("phone", respuesta.data["error"]["details"])

    def test_un_tamano_inventado_no_pasa(self) -> None:
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(operation_size="200-300"), format="json"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("operation_size", respuesta.data["error"]["details"])


class AccesoDualTests(TestCase):
    """Entrar con la clave de empleado o con el correo, indistintamente.

    Quien da de alta el negocio se registra con su correo y es lo unico que
    recuerda al dia siguiente; quien trabaja en el mostrador entra con su clave.
    Las dos puertas llevan al mismo lugar.
    """

    def setUp(self) -> None:
        cache.clear()
        APIClient().post(
            REGISTRO_URL,
            {
                "business_name": "Motel El Roble",
                "admin_full_name": "Sergio Paredes",
                "email": "sergio@elroble.mx",
                "username": "sergio",
                "phone": "833 210 4455",
                "operation_size": OperationSize.HASTA_10,
                "password": "Roble.2026!buena",
            },
            format="json",
        )

    def entrar(self, identificador: str, password: str = "Roble.2026!buena"):
        return APIClient().post(
            "/api/v1/auth/login/",
            {"username": identificador, "password": password},
            format="json",
        )

    def test_entra_con_su_clave_de_empleado(self) -> None:
        respuesta = self.entrar("sergio")

        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertIn("access", respuesta.data)

    def test_entra_con_su_correo(self) -> None:
        respuesta = self.entrar("sergio@elroble.mx")

        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["user"]["username"], "sergio")

    def test_el_correo_no_distingue_mayusculas(self) -> None:
        respuesta = self.entrar("Sergio@ElRoble.MX")

        self.assertEqual(respuesta.status_code, 200, respuesta.data)

    def test_la_contrasena_sigue_mandando(self) -> None:
        # La puerta nueva no puede ser una puerta abierta.
        self.assertEqual(self.entrar("sergio@elroble.mx", "otra-cosa").status_code, 401)
        self.assertEqual(self.entrar("sergio", "otra-cosa").status_code, 401)

    def test_un_correo_que_no_existe_no_entra(self) -> None:
        self.assertEqual(self.entrar("nadie@ningunlado.mx").status_code, 401)


class IdiomaDeLaApiTests(TestCase):
    """La API contesta en el idioma que pide el navegador.

    El frontend manda `Accept-Language` en cada petición; sin
    ``LocaleMiddleware`` Django lo ignoraba y devolvía todo en español, así que
    una pantalla en inglés mostraba sus errores en otro idioma.
    """

    def setUp(self) -> None:
        cache.clear()

    def payload(self, **cambios) -> dict:
        datos = {
            "business_name": "Riverside Inn",
            "admin_full_name": "Karen Fields",
            "email": "karen@riverside.example",
            "username": "karen",
            "phone": "555 908 7766",
            "operation_size": OperationSize.HASTA_10,
            "password": "12345678",
        }
        datos.update(cambios)
        return datos

    def razon(self, respuesta) -> str:
        return " ".join(respuesta.data["error"]["details"]["password"])

    def test_en_ingles_la_contrasena_se_rechaza_en_ingles(self) -> None:
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(), format="json", HTTP_ACCEPT_LANGUAGE="en"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("password", self.razon(respuesta).lower())

    def test_en_espanol_la_misma_contrasena_se_rechaza_en_espanol(self) -> None:
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(), format="json", HTTP_ACCEPT_LANGUAGE="es"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("contraseña", self.razon(respuesta).lower())

    def test_un_idioma_que_no_hablamos_cae_en_espanol(self) -> None:
        # `LANGUAGES` acota a los dos que sí existen: sin eso, un navegador en
        # portugués se llevaba media interfaz traducida a medias.
        respuesta = APIClient().post(
            REGISTRO_URL, self.payload(), format="json", HTTP_ACCEPT_LANGUAGE="pt-BR"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("contraseña", self.razon(respuesta).lower())
