"""Aislamiento entre moteles: lo que ve la sucursal A no toca a la B.

Estas pruebas son de regresión, no de diseño. Cada una corresponde a una fuga
real que ya ocurrió y que se cierra en el modelo o en la vista, no en el
``get_queryset()`` de cada pantalla: el filtro por motel vive en los managers
de ``common.managers`` y se vuelve a aplicar cada vez que DRF llama ``all()``.
Las dos formas conocidas de saltárselo -- un modelo que no declara manager
acotado y una vista que filtra sobre ``self.queryset`` en lugar de
``get_queryset()`` -- tienen aquí su prueba y, la primera, además un guardián
que revisa el árbol completo de modelos.
"""

from __future__ import annotations

from decimal import Decimal

from django.apps import apps
from django.test import TestCase
from rest_framework.test import APIClient

from common.managers import TenantQuerySet
from common.models import TenantModel
from common.tenancy import use_motel

from apps.inventory.constants import ProductKind
from apps.inventory.models import Product, ProductCategory, Warehouse, WarehouseStock
from apps.rooms.models import Room, RoomType
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User

STOCKS_URL = "/api/v1/inventory/stocks/"
PRODUCTS_URL = "/api/v1/inventory/products/"
WAREHOUSES_URL = "/api/v1/inventory/warehouses/"
USERS_URL = "/api/v1/auth/users/"
ROOMS_URL = "/api/v1/frontdesk/rooms/"
GRID_URL = "/api/v1/frontdesk/rooms/grid/"
OPEN_FOLIOS_URL = "/api/v1/sales/folios/open/"


class Sucursal:
    """Un motel con su gerente, su almacén, su producto y su habitación."""

    def __init__(self, nombre: str, sufijo: str) -> None:
        self.motel = Motel.objects.create(name=nombre)
        self.gerente = User.objects.create_user(
            username=f"gerencia.{sufijo}",
            password="Demo.1234",
            full_name=f"Gerencia {nombre}",
            role=Role.MANAGER,
            motel=self.motel,
        )
        with use_motel(self.motel):
            self.almacen = Warehouse.objects.create(code="GEN", name=f"General {sufijo}")
            self.categoria = ProductCategory.objects.create(
                name="Botanas", kind=ProductKind.FOOD
            )
            self.producto = Product.objects.create(
                sku=f"BOT-{sufijo}",
                name=f"Cacahuates {sufijo}",
                category=self.categoria,
                sale_price=Decimal("30.00"),
            )
            self.existencia = WarehouseStock.objects.create(
                product=self.producto,
                warehouse=self.almacen,
                quantity=Decimal("25"),
            )
            self.tipo = RoomType.objects.create(
                name="Sencilla", code="SEN", max_occupants=2
            )
            self.habitacion = Room.objects.create(
                number=f"10{sufijo[-1]}", room_type=self.tipo, floor=1
            )

    def client(self) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=self.gerente)
        return client


class AislamientoEntreSucursalesTests(TestCase):
    """La sucursal A pregunta por lo de la B y no recibe nada."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.a = Sucursal("Motel Norte", "a1")
        cls.b = Sucursal("Motel Sur", "b1")

    def ids(self, response) -> set[int]:
        datos = response.data
        filas = datos["results"] if isinstance(datos, dict) and "results" in datos else datos
        return {fila["id"] for fila in filas}

    # -- Inventario ------------------------------------------------------

    def test_las_existencias_de_la_otra_sucursal_no_aparecen(self) -> None:
        """La fuga original: ``WarehouseStock`` no declaraba manager acotado."""
        response = self.a.client().get(STOCKS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.existencia.pk})

    def test_pedir_una_existencia_ajena_por_id_es_404(self) -> None:
        response = self.a.client().get(f"{STOCKS_URL}{self.b.existencia.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_el_catalogo_de_productos_no_cruza_sucursales(self) -> None:
        response = self.a.client().get(PRODUCTS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.producto.pk})

    def test_pedir_un_producto_ajeno_por_id_es_404(self) -> None:
        response = self.a.client().get(f"{PRODUCTS_URL}{self.b.producto.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_editar_un_producto_ajeno_es_404(self) -> None:
        response = self.a.client().patch(
            f"{PRODUCTS_URL}{self.b.producto.pk}/", {"name": "Secuestrado"}, format="json"
        )

        self.assertEqual(response.status_code, 404)
        self.b.producto.refresh_from_db()
        self.assertNotEqual(self.b.producto.name, "Secuestrado")

    def test_los_almacenes_ajenos_tampoco_se_listan(self) -> None:
        response = self.a.client().get(WAREHOUSES_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.almacen.pk})

    # -- Personal --------------------------------------------------------

    def test_la_plantilla_de_la_otra_sucursal_no_se_ve(self) -> None:
        response = self.a.client().get(USERS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.gerente.pk})

    def test_pedir_un_empleado_ajeno_por_id_es_404(self) -> None:
        response = self.a.client().get(f"{USERS_URL}{self.b.gerente.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_editar_un_empleado_ajeno_es_404(self) -> None:
        response = self.a.client().patch(
            f"{USERS_URL}{self.b.gerente.pk}/", {"role": Role.RECEPTION}, format="json"
        )

        self.assertEqual(response.status_code, 404)
        self.b.gerente.refresh_from_db()
        self.assertEqual(self.b.gerente.role, Role.MANAGER)

    def test_dar_de_baja_a_un_empleado_ajeno_es_404(self) -> None:
        response = self.a.client().delete(f"{USERS_URL}{self.b.gerente.pk}/")

        self.assertEqual(response.status_code, 404)
        self.b.gerente.refresh_from_db()
        self.assertTrue(self.b.gerente.is_active)

    def test_el_listado_con_inactivos_tampoco_cruza(self) -> None:
        """``?include_inactive=true`` cambia de manager: no puede cambiar de motel."""
        response = self.a.client().get(USERS_URL, {"include_inactive": "true"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.gerente.pk})

    # -- Habitaciones ----------------------------------------------------

    def test_las_habitaciones_ajenas_no_se_listan(self) -> None:
        response = self.a.client().get(ROOMS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.habitacion.pk})

    def test_la_cuadricula_de_recepcion_solo_trae_lo_propio(self) -> None:
        response = self.a.client().get(GRID_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a.habitacion.pk})

    def test_pedir_una_habitacion_ajena_por_id_es_404(self) -> None:
        response = self.a.client().get(f"{ROOMS_URL}{self.b.habitacion.pk}/")

        self.assertEqual(response.status_code, 404)

    # -- Cuentas ---------------------------------------------------------

    def test_las_cuentas_abiertas_ajenas_no_se_listan(self) -> None:
        """La otra fuga: la acción filtraba sobre ``self.queryset``.

        Ese atributo se arma al importar el módulo -- sin petición, sin motel --
        así que el filtro por motel nunca llegaba a aplicarse.
        """
        from apps.sales import services as sales_services
        from apps.sales.constants import FolioType

        with use_motel(self.b.motel):
            folio = sales_services.open_folio(
                actor=self.b.gerente, folio_type=FolioType.COUNTER
            )

        response = self.a.client().get(OPEN_FOLIOS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(folio.pk, self.ids(response))


class ManagerAcotadoTests(TestCase):
    """Guardián estructural: ningún modelo con motel se queda sin filtro.

    Las fugas de inventario no vinieron de una vista mal escrita sino de un
    modelo que heredó ``TenantModel`` sin declarar manager. Revisar el árbol
    completo cuesta menos que auditar pantalla por pantalla cada vez que
    alguien agrega una tabla.
    """

    #: Único modelo que sale a proposito del filtro automático. ``next_value``
    #: filtra el motel a mano y necesita poder tocar el renglón sin motel de la
    #: plataforma; además no se expone por ninguna vista.
    EXENTOS = {"common.DocumentSequence"}

    def test_todo_modelo_con_motel_trae_manager_acotado(self) -> None:
        sin_filtro = []

        for model in apps.get_models():
            if not issubclass(model, TenantModel):
                continue
            etiqueta = f"{model._meta.app_label}.{model.__name__}"
            if etiqueta in self.EXENTOS:
                continue
            if not isinstance(model._default_manager.get_queryset(), TenantQuerySet):
                sin_filtro.append(etiqueta)

        self.assertEqual(
            sin_filtro,
            [],
            "Estos modelos pertenecen a un motel pero su manager por omisión no "
            "acota por motel; declara `objects = TenantManager()` (o el manager "
            "de baja lógica que corresponda): " + ", ".join(sin_filtro),
        )
