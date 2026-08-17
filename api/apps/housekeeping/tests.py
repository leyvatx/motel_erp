"""Pruebas de ama de llaves y mantenimiento (Fase 4)."""

from __future__ import annotations

from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone

from common.exceptions import DomainError, InvalidStateTransition

from apps.finances.services import open_shift
from apps.housekeeping import services
from apps.housekeeping.constants import (
    CleaningTaskStatus,
    CleaningTaskType,
    MaintenancePriority,
    MaintenanceStatus,
)
from apps.housekeeping.models import CleaningTask, MaintenanceReport, MaintenanceUpdate
from apps.rooms import services as frontdesk
from apps.rooms.constants import RoomStatus
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.users.constants import Role
from apps.users.models import User

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class HousekeepingTestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.recepcion = User.objects.create_user(
            username="recepcion4", password="Demo.1234", full_name="Dora Recepción",
            role=Role.RECEPTION,
        )
        cls.camarista = User.objects.create_user(
            username="limpieza1", password="Demo.1234", full_name="Eva Limpieza",
            role=Role.HOUSEKEEPING,
        )
        cls.room_type = RoomType.objects.create(name="Sencilla", code="SEN")
        cls.room = Room.objects.create(number="501", room_type=cls.room_type)
        cls.block = TariffBlock.objects.create(
            room_type=cls.room_type,
            name="4 horas",
            duration_minutes=240,
            base_price=Decimal("300.00"),
        )
        cls.shift = open_shift(cashier=cls.recepcion, opening_balance=Decimal("500.00"))

    def _checkout(self) -> Room:
        stay = frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        frontdesk.checkout_stay(
            stay_id=stay.pk,
            actor=self.recepcion,
            payments=[{"method": "CASH", "amount": Decimal("300.00")}],
        )
        self.room.refresh_from_db()
        return self.room


class CleaningFlowTests(HousekeepingTestCase):
    def test_el_checkout_crea_la_tarea_de_limpieza_sola(self) -> None:
        self._checkout()

        tarea = CleaningTask.objects.get(room=self.room)
        self.assertEqual(self.room.status, RoomStatus.CLEANING)
        self.assertEqual(tarea.status, CleaningTaskStatus.PENDING)
        self.assertEqual(tarea.task_type, CleaningTaskType.CHECKOUT)
        self.assertIsNotNone(tarea.stay_id)

    def test_no_se_duplica_la_tarea_abierta_de_un_cuarto(self) -> None:
        self._checkout()
        primera = CleaningTask.objects.get(room=self.room)

        segunda = services.create_cleaning_task(
            room=self.room, task_type=CleaningTaskType.DEEP, actor=self.recepcion
        )
        self.assertEqual(primera.pk, segunda.pk)
        self.assertEqual(CleaningTask.objects.filter(room=self.room).count(), 1)

    def test_ciclo_completo_mide_el_tiempo_y_libera_el_cuarto(self) -> None:
        self._checkout()
        tarea = CleaningTask.objects.get(room=self.room)

        services.assign_cleaning_task(
            task_id=tarea.pk, employee=self.camarista, actor=self.recepcion
        )
        services.start_cleaning_task(task_id=tarea.pk, actor=self.camarista)

        tarea.refresh_from_db()
        inicio = timezone.now() - timezone.timedelta(minutes=18)
        CleaningTask.objects.filter(pk=tarea.pk).update(started_at=inicio)

        services.finish_cleaning_task(
            task_id=tarea.pk, actor=self.camarista, notes="Todo en orden"
        )

        tarea.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(tarea.status, CleaningTaskStatus.DONE)
        self.assertEqual(tarea.assigned_to, self.camarista)
        self.assertGreaterEqual(tarea.duration_seconds, 18 * 60)
        self.assertEqual(self.room.status, RoomStatus.AVAILABLE)

    def test_no_se_puede_terminar_una_tarea_que_no_inicio(self) -> None:
        self._checkout()
        tarea = CleaningTask.objects.get(room=self.room)
        with self.assertRaises(InvalidStateTransition):
            services.finish_cleaning_task(task_id=tarea.pk, actor=self.camarista)

    def test_verificacion_posterior_al_cierre(self) -> None:
        self._checkout()
        tarea = CleaningTask.objects.get(room=self.room)
        services.start_cleaning_task(task_id=tarea.pk, actor=self.camarista)
        services.finish_cleaning_task(task_id=tarea.pk, actor=self.camarista)
        services.verify_cleaning_task(task_id=tarea.pk, actor=self.recepcion)

        tarea.refresh_from_db()
        self.assertEqual(tarea.status, CleaningTaskStatus.VERIFIED)
        self.assertEqual(tarea.verified_by, self.recepcion)


class MaintenanceFlowTests(HousekeepingTestCase):
    def test_reporte_bloqueante_saca_el_cuarto_de_servicio(self) -> None:
        reporte = services.report_maintenance(
            title="Fuga de agua en regadera",
            description="Gotea constante, moja el piso.",
            room_id=self.room.pk,
            priority=MaintenancePriority.HIGH,
            blocks_room=True,
            actor=self.camarista,
        )
        self.room.refresh_from_db()

        self.assertEqual(self.room.status, RoomStatus.MAINTENANCE)
        self.assertEqual(reporte.status, MaintenanceStatus.REPORTED)
        self.assertTrue(reporte.folio.startswith("MTO-"))
        self.assertEqual(reporte.updates.count(), 1)

    def test_no_se_bloquea_un_cuarto_con_renta_activa(self) -> None:
        frontdesk.rent_room(
            room_id=self.room.pk, tariff_block_id=self.block.pk, actor=self.recepcion
        )
        with self.assertRaises(DomainError):
            services.report_maintenance(
                title="Televisión sin señal",
                description="No enciende.",
                room_id=self.room.pk,
                blocks_room=True,
                actor=self.recepcion,
            )

    def test_seguimiento_hasta_resolucion_devuelve_el_cuarto_a_limpieza(self) -> None:
        reporte = services.report_maintenance(
            title="Clima no enfria",
            description="Solo sopla aire caliente.",
            room_id=self.room.pk,
            blocks_room=True,
            actor=self.camarista,
        )

        services.update_maintenance_status(
            report_id=reporte.pk,
            new_status=MaintenanceStatus.IN_PROGRESS,
            note="Se solicito el refrigerante",
            actor=self.recepcion,
        )
        services.update_maintenance_status(
            report_id=reporte.pk,
            new_status=MaintenanceStatus.RESOLVED,
            note="Recarga aplicada",
            resolution_notes="Se recargo gas y se limpió el filtro",
            cost=Decimal("850.00"),
            actor=self.recepcion,
        )

        reporte.refresh_from_db()
        self.room.refresh_from_db()

        self.assertEqual(reporte.status, MaintenanceStatus.RESOLVED)
        self.assertEqual(reporte.cost, Decimal("850.00"))
        self.assertEqual(MaintenanceUpdate.objects.filter(report=reporte).count(), 3)
        self.assertEqual(self.room.status, RoomStatus.CLEANING)
        tarea = CleaningTask.objects.get(room=self.room)
        self.assertEqual(tarea.task_type, CleaningTaskType.PREVENTIVE)

    def test_transicion_ilegal_del_reporte_es_rechazada(self) -> None:
        reporte = services.report_maintenance(
            title="Foco fundido",
            description="Bano principal.",
            room_id=self.room.pk,
            actor=self.camarista,
        )
        with self.assertRaises(InvalidStateTransition):
            services.update_maintenance_status(
                report_id=reporte.pk,
                new_status=MaintenanceStatus.RESOLVED,
                actor=self.recepcion,
            )

    def test_cuarto_sigue_bloqueado_si_queda_otro_reporte_abierto(self) -> None:
        primero = services.report_maintenance(
            title="Fuga en lavabo",
            description="Gotea.",
            room_id=self.room.pk,
            blocks_room=True,
            actor=self.camarista,
        )
        services.report_maintenance(
            title="Puerta descuadrada",
            description="No cierra bien.",
            room_id=self.room.pk,
            blocks_room=True,
            actor=self.camarista,
        )

        services.update_maintenance_status(
            report_id=primero.pk, new_status=MaintenanceStatus.IN_PROGRESS, actor=self.recepcion
        )
        services.update_maintenance_status(
            report_id=primero.pk, new_status=MaintenanceStatus.RESOLVED, actor=self.recepcion
        )

        self.room.refresh_from_db()
        self.assertEqual(self.room.status, RoomStatus.MAINTENANCE)
