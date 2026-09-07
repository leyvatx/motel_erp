"""Corredor de pruebas sin servicios externos.

La suite solo necesita PostgreSQL. Redis atiende la caché y los WebSockets en
producción, pero ninguna prueba mide su comportamiento como tal -- la única que
habla del tema, ``CacheOutageTests``, apunta a propósito a un Redis muerto con
su propio ``override_settings`` y sigue funcionando igual.

Sin esto, levantar la suite en una máquina nueva exige montar Redis además de
la base, y lo que se gana a cambio es cero cobertura: la caché es un atajo, no
una dependencia, y así está escrito el código.

Los reemplazos se hacen con ``override_settings`` y no asignando sobre
``settings``: los manejadores de caché y de canales guardan su configuración la
primera vez que alguien los pide, y solo la sueltan cuando llega la señal
``setting_changed`` que ``override_settings`` emite.
"""

from __future__ import annotations

from django.test.runner import DiscoverRunner
from django.test.utils import override_settings

CACHE_EN_MEMORIA = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "pruebas",
    }
}

CANALES_EN_MEMORIA = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


class TestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs) -> None:
        self._sustitutos = override_settings(
            CACHES=CACHE_EN_MEMORIA, CHANNEL_LAYERS=CANALES_EN_MEMORIA
        )
        self._sustitutos.enable()
        super().setup_test_environment(**kwargs)

    def teardown_test_environment(self, **kwargs) -> None:
        super().teardown_test_environment(**kwargs)
        self._sustitutos.disable()
