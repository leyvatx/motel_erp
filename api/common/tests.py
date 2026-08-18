"""Pruebas de la configuración que protege el arranque."""

from __future__ import annotations

import os
import subprocess
import sys

from django.conf import settings
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

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
