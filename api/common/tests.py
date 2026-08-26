"""Pruebas de la configuración que protege el arranque."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from common import ws_tickets
from common.health import SilenciarSondeos

from apps.settings.models import Motel, _cache_safe


class SecretKeyGuardTests(SimpleTestCase):
    """Arrancar en producción con la llave de desarrollo tiene que ser imposible.

    Esa llave firma los JWT de todos los moteles: un despliegue que se quede
    con la de ejemplo deja que cualquiera se fabrique una sesión de cualquier
    propiedad, y como ``DJANGO_DEBUG`` ya viene apagado por omisión eso pasa
    sin que nadie se entere. Se prueba en un proceso aparte porque la
    configuración se lee una sola vez, al importar.
    """

    def _arrancar(self, debug: str, secret_key: str) -> subprocess.CompletedProcess:
        entorno = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "core.settings",
            "DJANGO_DEBUG": debug,
            "DJANGO_SECRET_KEY": secret_key,
        }
        return subprocess.run(
            [sys.executable, "-c", "import django; django.setup()"],
            cwd=str(settings.BASE_DIR),
            env=entorno,
            capture_output=True,
            text=True,
        )

    def test_produccion_con_la_llave_de_desarrollo_no_arranca(self) -> None:
        resultado = self._arrancar("False", settings.INSECURE_SECRET_KEY)

        self.assertNotEqual(resultado.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", resultado.stderr)

    def test_produccion_con_llave_propia_arranca(self) -> None:
        resultado = self._arrancar("False", "llave-larga-de-una-instalacion-real")

        self.assertEqual(resultado.returncode, 0, resultado.stderr)

    def test_en_desarrollo_la_llave_de_ejemplo_sigue_sirviendo(self) -> None:
        resultado = self._arrancar("True", settings.INSECURE_SECRET_KEY)

        self.assertEqual(resultado.returncode, 0, resultado.stderr)


CACHE_CAIDA = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://127.0.0.1:6399/0",
        "OPTIONS": {"socket_connect_timeout": 1, "socket_timeout": 1},
    }
}


@override_settings(CACHES=CACHE_CAIDA)
class CacheOutageTests(SimpleTestCase):
    """Con la caché caída, recepción tiene que poder seguir cobrando.

    Redis atiende también los WebSockets y las tareas: si se cae se pierde el
    tiempo real y los cronómetros, pero rentar y cobrar no puede depender de
    eso. La caché es un atajo, no una dependencia.
    """

    def test_una_falla_de_la_cache_no_levanta(self) -> None:
        with self.assertRaises(Exception):
            cache.get("lo-que-sea")

        self.assertIsNone(_cache_safe(cache.get, "lo-que-sea"))
        self.assertIsNone(_cache_safe(cache.set, "lo-que-sea", 1, 5))
        self.assertIsNone(_cache_safe(cache.delete, "lo-que-sea"))

    def test_el_motel_vigente_responde_sin_cache(self) -> None:
        self.assertIsNotNone(Motel.current().name)


class HealthCheckTests(TestCase):
    """El sondeo contesta sin sesión y dice cuál dependencia se cayó.

    Lo primero importa porque Docker lo consulta sin credenciales; lo segundo
    porque un 503 que no distingue entre base y caché obliga a entrar al
    servidor justo cuando menos tiempo hay.
    """

    URL = "/api/v1/health/"

    def test_contesta_sin_autenticacion(self) -> None:
        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), {"database": "ok", "cache": "ok"})

    def test_reporta_503_y_senala_la_cache_caida(self) -> None:
        with mock.patch("common.health.cache.set", side_effect=RuntimeError("sin redis")):
            respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 503)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["database"], "ok")
        self.assertTrue(cuerpo["cache"].startswith("error"))

    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_no_lo_alcanza_la_redireccion_a_https(self) -> None:
        """Sin la excepción, Docker recibiría un 301 en vez del estado real."""
        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 200)


class WsTicketTests(TestCase):
    """El boleto vale una sola vez y para un solo usuario.

    Si se pudiera reusar, no habriamos ganado nada al sacarlo del JWT: seguiria
    bastando con leerlo de una bitacora para abrir el socket de alguien mas.
    """

    def test_el_canje_devuelve_el_contexto_que_se_emitio(self) -> None:
        boleto = ws_tickets.issue(user_id=7, motel_id=3, role="RECEPTION")

        self.assertEqual(
            ws_tickets.redeem(boleto),
            {"user_id": 7, "motel_id": 3, "role": "RECEPTION"},
        )

    def test_el_segundo_canje_no_devuelve_nada(self) -> None:
        boleto = ws_tickets.issue(user_id=7, motel_id=3, role="RECEPTION")

        self.assertIsNotNone(ws_tickets.redeem(boleto))
        self.assertIsNone(ws_tickets.redeem(boleto))

    def test_un_boleto_inventado_no_sirve(self) -> None:
        self.assertIsNone(ws_tickets.redeem("no-existe"))
        self.assertIsNone(ws_tickets.redeem(""))


class SondaDeVidaTests(SimpleTestCase):
    """La sonda contesta sin tocar nada y el filtro calla solo el ruido."""

    def test_awake_no_toca_base_ni_cache(self):
        """Si la sonda dependiera de algo, dejaría de servir justo al caerse."""
        with mock.patch("common.health.connection") as conexion, \
             mock.patch("common.health.cache") as memoria:
            respuesta = self.client.get("/api/health")

        conexion.cursor.assert_not_called()
        memoria.set.assert_not_called()
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["status"], "awake")
        self.assertIn("timestamp", respuesta.json())

    def test_filtro_calla_sondeos_pero_no_fallas(self):
        filtro = SilenciarSondeos()

        def linea(ruta: str, codigo: int) -> logging.LogRecord:
            return logging.LogRecord(
                "uvicorn.access", logging.INFO, "", 0,
                '%s - "%s %s HTTP/%s" %d',
                ("10.0.0.1:0", "GET", ruta, "1.1", codigo),
                None,
            )

        self.assertFalse(filtro.filter(linea("/api/health", 200)))
        self.assertFalse(filtro.filter(linea("/api/v1/health/", 200)))
        # Un sondeo que empieza a fallar es exactamente lo que hay que ver.
        self.assertTrue(filtro.filter(linea("/api/health", 500)))
        self.assertTrue(filtro.filter(linea("/api/v1/health/", 503)))
        # El tráfico de verdad no se toca.
        self.assertTrue(filtro.filter(linea("/api/v1/frontdesk/grid/", 200)))
