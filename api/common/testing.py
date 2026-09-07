"""Caso de prueba que corre dentro de una sucursal.

En producción nadie opera sin sucursal: ``HasMotelContext`` cierra la API
operativa a quien no tiene una, y desde que los grupos de tiempo real son por
sucursal, emitir un evento sin ella es un error duro. Una prueba que arma sus
datos fuera de ese contexto no está probando el sistema, está probando un
estado que la aplicación no permite -- y desde ese cambio ni siquiera llega a
correr: revienta al abrir el turno.

La sucursal se activa para toda la clase y no solo para el armado de datos,
porque muchas pruebas llaman a los servicios directamente desde el cuerpo del
test, donde no hay petición de la cual deducirla.

Lo que queda fuera a propósito: las pruebas de aislamiento entre sucursales
(``common.tests_tenancy``) y las que comparan lo que ve cada rol. Esas fijan su
propio contexto o lo dejan salir del usuario autenticado, que es justo lo que
miden. Fijar la sucursal aquí se las taparía.
"""

from __future__ import annotations

from django.test import TestCase

from apps.settings.models import Motel
from common.tenancy import activate_motel, deactivate_motel


class SucursalTestCase(TestCase):
    """``TestCase`` con una sucursal creada y activa durante toda la clase."""

    #: Se sobrescribe cuando el nombre ayuda a leer un fallo.
    motel_nombre = "Sucursal de pruebas"

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.motel = Motel.objects.create(name=cls.motel_nombre)
        # El token no se guarda: Django envuelve todo lo que se asigna aquí en
        # un descriptor que hace copias profundas, y un token de contextvar no
        # sobrevive a eso. Se limpia poniendo la variable en vacío.
        activate_motel(cls.motel)

    @classmethod
    def tearDownClass(cls) -> None:
        deactivate_motel()
        super().tearDownClass()
