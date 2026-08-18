from django.test import TestCase, override_settings
from rest_framework.test import APIClient

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
