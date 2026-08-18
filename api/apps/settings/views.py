"""API de configuración: ``/api/v1/settings/``."""

from __future__ import annotations

import zoneinfo

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.settings import services
from apps.settings.models import Motel
from apps.settings.serializers import (
    MotelCreateSerializer,
    MotelListSerializer,
    MotelSerializer,
    PublicMotelSerializer,
    TimeZoneOptionSerializer,
)
from apps.users.constants import PermissionCode
from apps.notifications.events import Event, broadcast
from common.tenancy import without_motel

COMMON_TIME_ZONES: tuple[tuple[str, str], ...] = (
    ("America/Mexico_City", "Centro (Ciudad de México)"),
    ("America/Cancun", "Sureste (Cancún)"),
    ("America/Merida", "Centro (Mérida)"),
    ("America/Monterrey", "Centro (Monterrey)"),
    ("America/Matamoros", "Frontera (Matamoros)"),
    ("America/Chihuahua", "Pacifico (Chihuahua)"),
    ("America/Ciudad_Juarez", "Frontera (Ciudad Juárez)"),
    ("America/Mazatlan", "Pacifico (Mazatlán)"),
    ("America/Hermosillo", "Pacifico (Hermosillo)"),
    ("America/Tijuana", "Noroeste (Tijuana)"),
    ("America/Bahia_Banderas", "Centro (Bahía de Banderas)"),
    ("UTC", "UTC"),
)


class PublicMotelView(APIView):
    """Marca del motel para quien todavia no inicia sesión.

    La pantalla de acceso tiene que saber cómo se llama el motel y qué
    logotipo poner antes de que alguien escriba su contraseña. Como sin sesión
    no hay forma de saber de qué motel se trata, la terminal recuerda el
    identificador del ultimo motel al que entró y lo manda en ``?slug=``.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="settings_motel_public",
        responses=PublicMotelSerializer,
        auth=[],
    )
    def get(self, request) -> Response:
        slug = request.query_params.get("slug", "").strip()

        with without_motel():
            motel = Motel.objects.filter(slug=slug).first() if slug else None

        if motel is None:
            motel = Motel.defaults()

        return Response(PublicMotelSerializer(motel).data)


class BusinessProfileView(APIView):
    """El motel de quien pregunta: lectura para el equipo, escritura para gerencia.

    Que recepción pueda leerlo es intencional: de ahí salen la moneda, la zona
    horaria y los minutos de aviso con los que el navegador arma la pantalla.
    Lo que no puede es cambiarlo.
    """

    parser_classes = [JSONParser, MultiPartParser, FormParser]
    required_permissions = {
        "read": [],
        "write": [PermissionCode.CONFIG_MANAGE],
    }

    @extend_schema(operation_id="settings_business_read", responses=MotelSerializer)
    def get(self, request) -> Response:
        return Response(MotelSerializer(Motel.current(), context={"request": request}).data)

    @extend_schema(
        operation_id="settings_business_update",
        request=MotelSerializer,
        responses=MotelSerializer,
    )
    def patch(self, request) -> Response:
        motel_id = getattr(request.user, "active_motel_id", None) or request.user.motel_id
        motel = Motel.all_objects.filter(pk=motel_id).first()
        if motel is None:
            return Response(
                {"error": {"code": "no_motel", "message": "Tu usuario no pertenece a un motel."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MotelSerializer(
            motel, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        motel = serializer.save()
        broadcast(
            Event.SETTINGS_CHANGED,
            {"motel_id": motel.pk, "updated_at": motel.updated_at.isoformat()},
            motel=motel,
        )
        return Response(serializer.data)


class MotelViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Alta y administración de moteles. Exclusivo de la plataforma."""

    serializer_class = MotelListSerializer
    allow_platform_scope = True
    required_permissions = {"*": [PermissionCode.MOTEL_MANAGE]}
    search_fields = ["name", "legal_name", "tax_id"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        from apps.rooms.models import Room

        room_count = (
            Room.all_objects.filter(motel_id=OuterRef("pk"), is_active=True)
            .values("motel_id")
            .annotate(total=Count("pk"))
            .values("total")
        )
        return (
            Motel.all_objects.all()
            .annotate(
                user_count=Count("users", filter=Q(users__is_active=True), distinct=True),
                room_count=Coalesce(
                    Subquery(room_count, output_field=IntegerField()),
                    Value(0),
                ),
            )
            .order_by("name")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return MotelCreateSerializer
        if self.action in {"retrieve", "update", "partial_update"}:
            return MotelSerializer
        return MotelListSerializer

    @extend_schema(request=MotelCreateSerializer, responses=MotelSerializer)
    def create(self, request, *args, **kwargs) -> Response:
        serializer = MotelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        motel = services.create_motel(actor=request.user, **serializer.validated_data)
        return Response(
            MotelSerializer(motel, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(responses=MotelSerializer)
    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None) -> Response:
        motel = self.get_object()
        services.deactivate_motel(
            motel=motel, actor=request.user, reason=request.data.get("reason", "")
        )
        return Response(MotelSerializer(motel, context={"request": request}).data)

    @extend_schema(responses=MotelSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None) -> Response:
        motel = self.get_object()
        motel.restore()
        return Response(MotelSerializer(motel, context={"request": request}).data)


class TimeZoneListView(APIView):
    """Zonas horarias sugeridas para el selector de configuración."""

    @extend_schema(
        operation_id="settings_time_zones",
        responses=TimeZoneOptionSerializer(many=True),
    )
    def get(self, request) -> Response:
        disponibles = zoneinfo.available_timezones()
        data = [
            {"value": value, "label": label}
            for value, label in COMMON_TIME_ZONES
            if value in disponibles
        ]
        return Response(TimeZoneOptionSerializer(data, many=True).data)
