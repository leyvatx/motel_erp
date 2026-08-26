from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.reports.services import ZERO, shift_trend_report
from common.utils import business_tz

from apps.rooms.models import Room, RoomType
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel


@override_settings(SECURE_SSL_REDIRECT=False)
class ReportsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.first = Motel.objects.create(name="Reporte Uno")
        cls.second = Motel.objects.create(name="Reporte Dos")
        cls.manager = User.objects.create_user(
            username="report_manager",
            password="Demo.1234",
            full_name="Gerencia Reportes",
            role=Role.MANAGER,
            motel=cls.first,
        )
        cls.reception = User.objects.create_user(
            username="report_reception",
            password="Demo.1234",
            full_name="Recepción Reportes",
            role=Role.RECEPTION,
            motel=cls.first,
        )
        with use_motel(cls.first):
            first_type = RoomType.objects.create(name="Sencilla", code="SEN")
            Room.objects.create(number="101", room_type=first_type)
        with use_motel(cls.second):
            second_type = RoomType.objects.create(name="Suite", code="SUI")
            Room.objects.create(number="901", room_type=second_type)

    def auth(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_gerencia_solo_ve_habitaciones_de_su_motel(self):
        response = self.auth(self.manager).get("/api/v1/reports/occupancy/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["rooms"], 1)

    def test_recepcion_no_puede_ver_reportes(self):
        response = self.auth(self.reception).get("/api/v1/reports/revenue/")
        self.assertEqual(response.status_code, 403)

    def test_rechaza_periodos_invertidos(self):
        response = self.auth(self.manager).get(
            "/api/v1/reports/revenue/", {"from": "2026-08-18", "to": "2026-08-01"}
        )
        self.assertEqual(response.status_code, 400)

    def test_exporta_csv(self):
        response = self.auth(self.manager).get(
            "/api/v1/reports/occupancy/", {"export": "csv"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")


class ShiftTrendTests(SimpleTestCase):
    """La serie por hora no puede tener huecos ni crecer sin límite."""

    @staticmethod
    def _serie(abierto, ventas, rentas):
        class FakeQS:
            def __init__(self, filas):
                self.filas = filas

            def filter(self, *a, **k):
                return self

            exclude = annotate = values = filter

            def __iter__(self):
                return iter(self.filas)

        turno = mock.Mock(code="T-PRUEBA", opened_at=abierto, closed_at=None)
        with mock.patch("apps.reports.services.Payment") as pagos, \
             mock.patch("apps.reports.services.Stay") as rentas_qs:
            pagos.objects = FakeQS(ventas)
            rentas_qs.objects = FakeQS(rentas)
            return shift_trend_report(turno)

    def test_sin_turno_abierto_devuelve_vacio(self):
        self.assertEqual(shift_trend_report(None), {"shift": None, "hours": []})

    def test_las_horas_sin_ventas_valen_cero_y_no_faltan(self):
        """Si una hora vacía se omite, la línea une las vecinas y dibuja una
        pendiente continua donde en realidad no pasó nada."""
        tz = business_tz()
        abierto = timezone.now().astimezone(tz).replace(minute=17, second=0, microsecond=0)
        abierto -= timedelta(hours=5)
        en_punto = abierto.replace(minute=0, second=0, microsecond=0)

        serie = self._serie(
            abierto,
            ventas=[
                {"hora": en_punto, "total": Decimal("500.00")},
                {"hora": en_punto + timedelta(hours=3), "total": Decimal("250.00")},
            ],
            rentas=[{"hora": en_punto, "total": 2}],
        )["hours"]

        self.assertEqual(len(serie), 6)
        self.assertEqual(serie[0]["sales"], Decimal("500.00"))
        self.assertEqual(serie[1]["sales"], ZERO)
        self.assertEqual(serie[2]["sales"], ZERO)
        self.assertEqual(serie[3]["sales"], Decimal("250.00"))
        self.assertEqual(serie[0]["rentals"], 2)
        self.assertEqual(serie[1]["rentals"], 0)
        self.assertEqual([h["label"] for h in serie], sorted(h["label"] for h in serie))

    def test_un_turno_olvidado_abierto_no_devuelve_mil_puntos(self):
        tz = business_tz()
        abierto = timezone.now().astimezone(tz) - timedelta(days=3)
        self.assertEqual(len(self._serie(abierto, [], [])["hours"]), 24)
