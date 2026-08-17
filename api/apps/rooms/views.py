"""API de recepción.

Las vistas son delgadas a proposito: validan la entrada con un serializador,
llaman al service correspondiente y devuelven el resultado. Ninguna regla de
negocio vive aquí.
"""

from __future__ import annotations

from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.pagination import LargePagination

from apps.rooms import services
from apps.users.constants import PermissionCode
from apps.rooms.constants import RoomStatus, StayStatus
from apps.rooms.models import (
    Holiday,
    Reservation,
    Room,
    RoomStatusLog,
    RoomType,
    Stay,
    TariffBlock,
    TariffRule,
)
from apps.rooms.serializers import (
    CheckoutStaySerializer,
    ExtendStaySerializer,
    HolidaySerializer,
    ReasonSerializer,
    ReservationInputSerializer,
    ReservationSerializer,
    RentRoomSerializer,
    RoomGridSerializer,
    RoomSerializer,
    RoomServiceStatusSerializer,
    RoomStatusLogSerializer,
    RoomStatusSummarySerializer,
    RoomTypeSerializer,
    StayListSerializer,
    StaySerializer,
    TariffBlockSerializer,
    TariffRuleSerializer,
)


def active_stay_prefetch() -> Prefetch:
    """Trae la renta activa de cada cuarto sin disparar N+1."""
    return Prefetch(
        "stays",
        queryset=Stay.objects.filter(status=StayStatus.ACTIVE).select_related(
            "tariff_block", "folio"
        ),
        to_attr="active_stays",
    )


class RoomTypeViewSet(viewsets.ModelViewSet):
    queryset = RoomType.objects.all()
    serializer_class = RoomTypeSerializer
    required_permissions = {"write": [PermissionCode.CONFIG_MANAGE]}
    pagination_class = LargePagination
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]

    def perform_destroy(self, instance: RoomType) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de catalogo")


class TariffBlockViewSet(viewsets.ModelViewSet):
    queryset = TariffBlock.objects.select_related("room_type").prefetch_related("rules")
    serializer_class = TariffBlockSerializer
    required_permissions = {"write": [PermissionCode.CONFIG_MANAGE]}
    pagination_class = LargePagination
    filterset_fields = ["room_type", "is_active", "is_overnight"]
    ordering_fields = ["sort_order", "duration_minutes", "base_price"]

    def perform_destroy(self, instance: TariffBlock) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de tarifa")


class TariffRuleViewSet(viewsets.ModelViewSet):
    queryset = TariffRule.objects.select_related("tariff_block")
    serializer_class = TariffRuleSerializer
    required_permissions = {"write": [PermissionCode.CONFIG_MANAGE]}
    filterset_fields = ["tariff_block", "rule_type", "is_active"]

    def perform_destroy(self, instance: TariffRule) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de regla tarifaria")


class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    required_permissions = {"write": [PermissionCode.CONFIG_MANAGE]}
    pagination_class = LargePagination
    filterset_fields = ["is_active"]

    def perform_destroy(self, instance: Holiday) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de festivo")


@extend_schema_view(
    list=extend_schema(description="Catalogo de habitaciones."),
)
class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.select_related("room_type")
    serializer_class = RoomSerializer
    required_permissions = {
        "write": [PermissionCode.CONFIG_MANAGE],
        "out_of_service": [PermissionCode.ROOM_FORCE_STATUS],
        "finish_cleaning": [PermissionCode.HOUSEKEEPING_TASK],
    }
    pagination_class = LargePagination
    filterset_fields = ["status", "room_type", "floor", "is_active", "has_garage"]
    search_fields = ["number", "zone"]
    ordering_fields = ["number", "floor", "status"]

    def perform_destroy(self, instance: Room) -> None:
        instance.soft_delete(user=self.request.user, reason="Baja de habitación")

    @extend_schema(responses=RoomGridSerializer(many=True))
    @action(detail=False, methods=["get"])
    def grid(self, request) -> Response:
        """Grid visual de recepción con la renta activa de cada cuarto."""
        queryset = (
            Room.objects.filter(is_active=True)
            .select_related("room_type")
            .prefetch_related(active_stay_prefetch())
            .order_by("floor", "number")
        )
        room_type = request.query_params.get("room_type")
        if room_type:
            queryset = queryset.filter(room_type_id=room_type)
        room_status = request.query_params.get("status")
        if room_status:
            queryset = queryset.filter(status=room_status)

        page = self.paginate_queryset(queryset)
        serializer = RoomGridSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(responses=RoomStatusSummarySerializer(many=True))
    @action(detail=False, methods=["get"])
    def summary(self, request) -> Response:
        """Conteo de habitaciones por estado para las tarjetas del dashboard."""
        counts = dict(
            Room.objects.filter(is_active=True)
            .values_list("status")
            .annotate(total=Count("id"))
        )
        data = [
            {"status": value, "status_display": label, "count": counts.get(value, 0)}
            for value, label in RoomStatus.choices
        ]
        return Response(RoomStatusSummarySerializer(data, many=True).data)

    @extend_schema(request=RoomServiceStatusSerializer, responses=RoomSerializer)
    @action(detail=True, methods=["post"], url_path="out-of-service")
    def out_of_service(self, request, pk=None) -> Response:
        serializer = RoomServiceStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = services.set_room_out_of_service(
            room_id=int(pk), actor=request.user, **serializer.validated_data
        )
        return Response(RoomSerializer(room).data)

    @extend_schema(request=None, responses=RoomSerializer)
    @action(detail=True, methods=["post"], url_path="finish-cleaning")
    def finish_cleaning(self, request, pk=None) -> Response:
        room = services.finish_cleaning(room_id=int(pk), actor=request.user)
        return Response(RoomSerializer(room).data)

    @extend_schema(responses=RoomStatusLogSerializer(many=True))
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None) -> Response:
        queryset = (
            RoomStatusLog.objects.filter(room_id=pk)
            .select_related("changed_by", "stay")
            .order_by("-created_at")
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(RoomStatusLogSerializer(page, many=True).data)


class StayViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Rentas: alta, extensión, cobro y cancelación.

    Las escrituras se hacen por acciones explicitas, no por PUT/PATCH: el
    estado de una renta no es un campo editable.
    """

    queryset = Stay.objects.select_related(
        "room", "room_type", "tariff_block", "folio", "created_by"
    )
    serializer_class = StaySerializer
    required_permissions = {
        "rent": [PermissionCode.ROOM_RENT],
        "extend": [PermissionCode.ROOM_EXTEND],
        "checkout": [PermissionCode.ROOM_CHECKOUT],
        "cancel": [PermissionCode.ROOM_CANCEL],
    }
    filterset_fields = ["status", "room", "room_type"]
    search_fields = ["code", "vehicle_plate", "guest_name", "room__number"]
    ordering_fields = ["check_in_at", "expires_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return StayListSerializer
        return StaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "retrieve":
            return queryset.prefetch_related("extensions")
        return queryset

    @extend_schema(request=RentRoomSerializer, responses=StaySerializer)
    @action(detail=False, methods=["post"])
    def rent(self, request) -> Response:
        """Renta una habitación. El servidor fija precio y ``expires_at``."""
        serializer = RentRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stay = services.rent_room(actor=request.user, **serializer.validated_data)
        stay = self.get_queryset().get(pk=stay.pk)
        return Response(StaySerializer(stay).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=StayListSerializer(many=True))
    @action(detail=False, methods=["get"])
    def active(self, request) -> Response:
        queryset = self.get_queryset().filter(status=StayStatus.ACTIVE).order_by("expires_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(StayListSerializer(page, many=True).data)

    @extend_schema(responses=StayListSerializer(many=True))
    @action(detail=False, methods=["get"])
    def expiring(self, request) -> Response:
        """Rentas vencidas o a punto de vencer (para la barra de alertas)."""
        from datetime import timedelta

        from django.conf import settings
        from django.utils import timezone

        limit = timezone.now() + timedelta(minutes=settings.EXPIRATION_WARNING_MINUTES)
        queryset = (
            self.get_queryset()
            .filter(status=StayStatus.ACTIVE)
            .filter(Q(expires_at__lte=limit))
            .order_by("expires_at")
        )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(StayListSerializer(page, many=True).data)

    @extend_schema(request=ExtendStaySerializer, responses=StaySerializer)
    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None) -> Response:
        serializer = ExtendStaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.extend_stay(stay_id=int(pk), actor=request.user, **serializer.validated_data)
        stay = self.get_queryset().prefetch_related("extensions").get(pk=pk)
        return Response(StaySerializer(stay).data)

    @extend_schema(request=CheckoutStaySerializer, responses=StaySerializer)
    @action(detail=True, methods=["post"])
    def checkout(self, request, pk=None) -> Response:
        """Cobra y cierra la renta; el cuarto pasa automáticamente a limpieza."""
        serializer = CheckoutStaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.checkout_stay(stay_id=int(pk), actor=request.user, **serializer.validated_data)
        stay = self.get_queryset().get(pk=pk)
        return Response(StaySerializer(stay).data)

    @extend_schema(request=ReasonSerializer, responses=StaySerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cancel_stay(
            stay_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        stay = self.get_queryset().get(pk=pk)
        return Response(StaySerializer(stay).data)


class ReservationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Reservation.objects.select_related("room", "room_type", "tariff_block")
    serializer_class = ReservationSerializer
    required_permissions = {"write": [PermissionCode.RESERVATION_MANAGE]}
    filterset_fields = ["status", "room", "room_type"]
    search_fields = ["code", "guest_name", "vehicle_plate"]
    ordering_fields = ["scheduled_start", "created_at"]

    @extend_schema(request=ReservationInputSerializer, responses=ReservationSerializer)
    def create(self, request) -> Response:
        serializer = ReservationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation = services.create_reservation(actor=request.user, **serializer.validated_data)
        return Response(
            ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=ReasonSerializer, responses=ReservationSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None) -> Response:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation = services.cancel_reservation(
            reservation_id=int(pk), reason=serializer.validated_data["reason"], actor=request.user
        )
        return Response(ReservationSerializer(reservation).data)
