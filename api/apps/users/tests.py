"""Pruebas de acceso y de la clave de empleado.

Lo que se cuida aquí es que la clave sea única *dentro* del motel y que el
acceso sepa a cuál de los cincuenta entrar sin preguntar de más.
"""

from __future__ import annotations

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User

LOGIN_URL = "/api/v1/auth/login/"
USERS_URL = "/api/v1/auth/users/"
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
