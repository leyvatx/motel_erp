"""Rutas de recepción: ``/api/v1/rooms/``."""

from rest_framework.routers import DefaultRouter

from apps.rooms.views import (
    HolidayViewSet,
    ReservationViewSet,
    RoomTypeViewSet,
    RoomViewSet,
    StayViewSet,
    TariffBlockViewSet,
    TariffRuleViewSet,
)

router = DefaultRouter()
router.register("rooms", RoomViewSet, basename="room")
router.register("room-types", RoomTypeViewSet, basename="room-type")
router.register("tariff-blocks", TariffBlockViewSet, basename="tariff-block")
router.register("tariff-rules", TariffRuleViewSet, basename="tariff-rule")
router.register("holidays", HolidayViewSet, basename="holiday")
router.register("stays", StayViewSet, basename="stay")
router.register("reservations", ReservationViewSet, basename="reservation")

urlpatterns = router.urls
