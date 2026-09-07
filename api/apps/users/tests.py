"""Pruebas de acceso y de la clave de empleado.

Lo que se cuida aquí es que la clave sea única *dentro* del motel y que el
acceso sepa a cuál de los cincuenta entrar sin preguntar de más.
"""

from __future__ import annotations

from io import StringIO

from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.settings.models import Motel
from apps.users import sessions
from apps.users.constants import Role
from apps.users.models import User, UserSession

LOGIN_URL = "/api/v1/auth/login/"
USERS_URL = "/api/v1/auth/users/"
REFRESH_URL = "/api/v1/auth/refresh/"
SESSIONS_URL = "/api/v1/auth/sessions/"
ME_URL = "/api/v1/auth/me/"
PASSWORD = "Demo.1234"


class MotelUsersTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.arcos = Motel.objects.create(name="Arcos Prueba")
        cls.palmas = Motel.objects.create(name="Palmas Prueba")

        cls.dueno_arcos = User.objects.create_user(
            username="dueno", password=PASSWORD, full_name="Dueña de Arcos",
            role=Role.SUPERADMIN, motel=cls.arcos,
        )
        cls.dueno_palmas = User.objects.create_user(
            username="dueno", password=PASSWORD, full_name="Dueño de Palmas",
            role=Role.SUPERADMIN, motel=cls.palmas,
        )

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    def auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client


class UsernameScopeTests(MotelUsersTestCase):
    """La clave de empleado es única dentro del motel, no en la plataforma."""

    def test_dos_moteles_usan_la_misma_clave(self) -> None:
        self.assertEqual(self.dueno_arcos.username, self.dueno_palmas.username)
        self.assertNotEqual(self.dueno_arcos.motel_id, self.dueno_palmas.motel_id)

    def test_cada_motel_da_de_alta_su_propia_recepcion(self) -> None:
        alta = {
            "username": "recepcion",
            "full_name": "Quien recibe",
            "role": Role.RECEPTION,
            "password": PASSWORD,
        }

        primera = self.auth(self.dueno_arcos).post(USERS_URL, alta)
        vecina = self.auth(self.dueno_palmas).post(USERS_URL, alta)

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(vecina.status_code, 201)
        self.assertEqual(User.all_objects.filter(username="recepcion").count(), 2)

    def test_la_clave_no_se_repite_dentro_del_mismo_motel(self) -> None:
        alta = {
            "username": "recepcion",
            "full_name": "Quien recibe",
            "role": Role.RECEPTION,
            "password": PASSWORD,
        }
        self.auth(self.dueno_arcos).post(USERS_URL, alta)

        repetida = self.auth(self.dueno_arcos).post(USERS_URL, alta)

        self.assertEqual(repetida.status_code, 400)
        self.assertEqual(User.all_objects.filter(motel=self.arcos, username="recepcion").count(), 1)

    def test_una_baja_conserva_su_clave_ocupada(self) -> None:
        empleado = User.objects.create_user(
            username="salio", password=PASSWORD, full_name="Ya no trabaja aquí",
            role=Role.RECEPTION, motel=self.arcos,
        )
        empleado.soft_delete()

        repetida = self.auth(self.dueno_arcos).post(
            USERS_URL,
            {"username": "salio", "full_name": "Otro", "role": Role.RECEPTION, "password": PASSWORD},
        )

        self.assertEqual(repetida.status_code, 400)


class LoginMotelTests(MotelUsersTestCase):
    """El acceso resuelve a qué motel entra antes de validar la contraseña."""

    def test_con_el_motel_entra_a_la_cuenta_de_ese_motel(self) -> None:
        response = self.client.post(
            LOGIN_URL,
            {"username": "dueno", "password": PASSWORD, "motel": self.palmas.slug},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["id"], self.dueno_palmas.pk)
        self.assertEqual(response.data["user"]["motel"], self.palmas.pk)

    def test_sin_motel_y_con_la_clave_repetida_pide_el_motel(self) -> None:
        response = self.client.post(LOGIN_URL, {"username": "dueno", "password": PASSWORD})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "motel_requerido")

    def test_sin_motel_y_con_la_clave_unica_entra_derecho(self) -> None:
        User.objects.create_user(
            username="unica", password=PASSWORD, full_name="Sola en la plataforma",
            role=Role.RECEPTION, motel=self.arcos,
        )

        response = self.client.post(LOGIN_URL, {"username": "unica", "password": PASSWORD})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["motel"], self.arcos.pk)

    def test_un_motel_que_no_existe_no_da_acceso(self) -> None:
        response = self.client.post(
            LOGIN_URL,
            {"username": "dueno", "password": PASSWORD, "motel": "motel-inventado"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "motel_desconocido")

    def test_el_motel_correcto_no_acepta_la_contrasena_del_vecino(self) -> None:
        self.dueno_palmas.set_password("Otra.Clave99")
        self.dueno_palmas.save(update_fields=["password"])

        response = self.client.post(
            LOGIN_URL,
            {"username": "dueno", "password": PASSWORD, "motel": self.palmas.slug},
        )

        self.assertEqual(response.status_code, 401)

    def test_la_cuenta_de_plataforma_entra_sin_motel(self) -> None:
        User.objects.create_superuser(
            username="plataforma", password=PASSWORD, full_name="Soporte"
        )

        response = self.client.post(LOGIN_URL, {"username": "plataforma", "password": PASSWORD})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["user"]["is_platform_admin"])


class SesionesTests(MotelUsersTestCase):
    """Sesiones vivas, corte inmediato y el refresh que ya no revienta."""

    def entrar(self, username: str, slug: str) -> dict:
        respuesta = self.client.post(
            LOGIN_URL, {"username": username, "password": PASSWORD, "motel": slug}
        )
        self.assertEqual(respuesta.status_code, 200)
        return respuesta.data

    def con_acceso(self, access: str) -> APIClient:
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return cliente

    def test_entrar_deja_registro_de_la_sesion(self) -> None:
        self.entrar("dueno", self.arcos.slug)

        sesion = UserSession.objects.get(user=self.dueno_arcos)
        self.assertIsNone(sesion.revoked_at)
        self.assertIsNotNone(sesion.last_seen_at)
        self.assertTrue(sesion.jti)

    def test_el_refresh_de_un_usuario_dado_de_baja_contesta_401(self) -> None:
        """Antes salía 500: el manager filtra inactivos y el DoesNotExist subía crudo.

        El 401 no es cosmético. El frontend conserva la sesión con cualquier
        5xx -- a propósito, para aguantar un servidor dormido -- así que con el
        500 el operador se quedaba atrapado en una pantalla inservible.
        """
        datos = self.entrar("dueno", self.arcos.slug)
        self.dueno_arcos.is_active = False
        self.dueno_arcos.save(update_fields=["is_active"])

        respuesta = self.client.post(REFRESH_URL, {"refresh": datos["refresh"]})

        self.assertEqual(respuesta.status_code, 401)

    def test_revocar_corta_el_access_token_que_ya_estaba_emitido(self) -> None:
        """El punto entero de revisar la sesión en cada petición.

        Sin esto el token seguiría sirviendo hasta media hora después, que es lo
        que dura su vigencia.
        """
        datos = self.entrar("dueno", self.arcos.slug)
        cliente = self.con_acceso(datos["access"])
        self.assertEqual(cliente.get(ME_URL).status_code, 200)

        sesion = UserSession.objects.get(user=self.dueno_arcos)
        sessions.revocar(sesion)

        self.assertEqual(cliente.get(ME_URL).status_code, 401)

    def test_una_sesion_revocada_tampoco_puede_renovar(self) -> None:
        datos = self.entrar("dueno", self.arcos.slug)
        sessions.revocar(UserSession.objects.get(user=self.dueno_arcos))

        respuesta = self.client.post(REFRESH_URL, {"refresh": datos["refresh"]})

        self.assertEqual(respuesta.status_code, 401)

    def test_renovar_conserva_la_sesion_y_actualiza_su_token(self) -> None:
        datos = self.entrar("dueno", self.arcos.slug)
        anterior = UserSession.objects.get(user=self.dueno_arcos).jti

        respuesta = self.client.post(REFRESH_URL, {"refresh": datos["refresh"]})

        self.assertEqual(respuesta.status_code, 200)
        sesion = UserSession.objects.get(user=self.dueno_arcos)
        self.assertIsNone(sesion.revoked_at)
        self.assertNotEqual(sesion.jti, anterior)

    def test_cada_quien_ve_sus_sesiones_y_gerencia_las_de_su_sucursal(self) -> None:
        recepcion = User.objects.create_user(
            username="recibe", password=PASSWORD, full_name="Quien recibe",
            role=Role.RECEPTION, motel=self.arcos,
        )
        self.entrar("dueno", self.arcos.slug)
        propias = self.entrar("recibe", self.arcos.slug)
        self.entrar("dueno", self.palmas.slug)

        suyas = self.con_acceso(propias["access"]).get(SESSIONS_URL)
        self.assertEqual(suyas.status_code, 200)
        self.assertEqual({fila["user"] for fila in suyas.data["results"]}, {recepcion.pk})

        del_dueno = self.auth(self.dueno_arcos).get(SESSIONS_URL)
        usuarios = {fila["user"] for fila in del_dueno.data["results"]}
        self.assertEqual(usuarios, {self.dueno_arcos.pk, recepcion.pk})
        self.assertNotIn(self.dueno_palmas.pk, usuarios)

    def test_gerencia_expulsa_y_el_expulsado_deja_de_operar(self) -> None:
        recepcion = User.objects.create_user(
            username="recibe", password=PASSWORD, full_name="Quien recibe",
            role=Role.RECEPTION, motel=self.arcos,
        )
        datos = self.entrar("recibe", self.arcos.slug)
        cliente = self.con_acceso(datos["access"])
        sesion = UserSession.objects.get(user=recepcion)

        corte = self.auth(self.dueno_arcos).post(f"{SESSIONS_URL}{sesion.sid}/revoke/")

        self.assertEqual(corte.status_code, 204)
        self.assertEqual(cliente.get(ME_URL).status_code, 401)

    def test_nadie_expulsa_a_la_sucursal_de_al_lado(self) -> None:
        self.entrar("dueno", self.palmas.slug)
        ajena = UserSession.objects.get(user=self.dueno_palmas)

        corte = self.auth(self.dueno_arcos).post(f"{SESSIONS_URL}{ajena.sid}/revoke/")

        self.assertEqual(corte.status_code, 404)
        ajena.refresh_from_db()
        self.assertIsNone(ajena.revoked_at)

    def test_salir_cierra_la_sesion_y_no_solo_el_token(self) -> None:
        datos = self.entrar("dueno", self.arcos.slug)
        cliente = self.con_acceso(datos["access"])

        salida = cliente.post("/api/v1/auth/logout/", {"refresh": datos["refresh"]})

        self.assertEqual(salida.status_code, 204)
        self.assertIsNotNone(UserSession.objects.get(user=self.dueno_arcos).revoked_at)
        self.assertEqual(cliente.get(ME_URL).status_code, 401)


class CrearAdminDelClienteTests(TestCase):
    """La cuenta con la que un cliente estrena el sistema.

    Lo que se cuida aquí es que mande sobre una sucursal y no sobre la
    plataforma: un superusuario sin sucursal ve el alta de sucursales y nada
    más, así que no puede rentar ni llega nunca al asistente de alta.
    """

    def setUp(self) -> None:
        """Sistema recién entregado: sin ninguna sucursal.

        La migración inicial siembra una a partir de BUSINESS_NAME, así que una
        base nueva nunca está del todo vacía. El caso que se prueba aquí es el
        de después de retirarla con reset_tenant, que es como queda un sistema
        listo para entregar.
        """
        cache.clear()
        # all_objects es un Manager llano, así que este borrado es el de verdad.
        Motel.all_objects.all().delete()

    def correr(self, **opciones) -> str:
        salida = StringIO()
        call_command("create_client_admin", stdout=salida, **opciones)
        return salida.getvalue()

    def test_el_punto_de_partida_es_un_sistema_sin_sucursales(self) -> None:
        """Deja claro contra qué corren las demás.

        Una base recién migrada sí trae una sucursal, sembrada por la migración
        inicial a partir de BUSINESS_NAME. El estado de aquí es el de después de
        retirarla, que es como queda un sistema listo para entregar.
        """
        self.assertEqual(Motel.all_objects.count(), 0)

    def test_crea_la_sucursal_cuando_no_hay_ninguna(self) -> None:
        self.correr(email="admin@cliente.com", password=PASSWORD)

        usuario = User.all_objects.get(username="admin")
        self.assertEqual(usuario.role, Role.SUPERADMIN)
        self.assertIsNotNone(usuario.motel_id)
        self.assertEqual(usuario.motel.name, "Mi negocio")

    def test_la_cuenta_manda_en_su_sucursal_y_no_en_la_plataforma(self) -> None:
        """Es la diferencia con createsuperuser, y la razón de que exista esto."""
        self.correr(email="admin@cliente.com", password=PASSWORD)

        usuario = User.all_objects.get(username="admin")
        self.assertFalse(usuario.is_platform_admin)
        self.assertTrue(usuario.is_superadmin)

    def test_la_cuenta_recien_creada_puede_entrar(self) -> None:
        self.correr(email="admin@cliente.com", password=PASSWORD)

        respuesta = APIClient().post(
            LOGIN_URL, {"username": "admin", "password": PASSWORD}
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["user"]["is_platform_admin"])

    def test_se_suma_a_la_sucursal_que_ya_existe(self) -> None:
        arcos = Motel.objects.create(name="Arcos Prueba")

        self.correr(email="gerencia@cliente.com", password=PASSWORD)

        usuario = User.all_objects.get(username="gerencia")
        self.assertEqual(usuario.motel_id, arcos.pk)
        self.assertEqual(Motel.objects.count(), 1)

    def test_con_varias_sucursales_exige_elegir(self) -> None:
        Motel.objects.create(name="Arcos Prueba")
        Motel.objects.create(name="Palmas Prueba")

        with self.assertRaises(CommandError) as fallo:
            self.correr(email="admin@cliente.com", password=PASSWORD)

        self.assertIn("--sucursal", str(fallo.exception))

    def test_no_pisa_una_clave_ya_ocupada(self) -> None:
        self.correr(email="admin@cliente.com", password=PASSWORD)

        with self.assertRaises(CommandError):
            self.correr(email="admin@otro.com", password=PASSWORD)

        self.assertEqual(User.all_objects.filter(username="admin").count(), 1)

    def test_rechaza_una_contrasena_debil_antes_de_crear_nada(self) -> None:
        with self.assertRaises(CommandError):
            self.correr(email="admin@cliente.com", password="12345678")

        self.assertFalse(User.all_objects.filter(username="admin").exists())
        self.assertFalse(Motel.all_objects.exists())

    def test_rechaza_un_correo_que_no_da_una_clave_valida(self) -> None:
        with self.assertRaises(CommandError) as fallo:
            self.correr(email="a@cliente.com", password=PASSWORD)

        self.assertIn("--username", str(fallo.exception))
