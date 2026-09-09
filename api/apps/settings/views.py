"""API de configuración: ``/api/v1/settings/``."""

from __future__ import annotations

import zoneinfo

from django.conf import settings as django_settings
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.settings import services
from apps.settings.models import Motel, SignupAttempt
from apps.settings.serializers import (
    MotelCreateSerializer,
    MotelListSerializer,
    MotelSerializer,
    PublicMotelSerializer,
    RegistroPublicoSerializer,
    TimeZoneOptionSerializer,
)
from apps.users.constants import PermissionCode
from apps.users.models import User
from apps.users.serializers import MotelTokenObtainPairSerializer, UserSerializer
from apps.notifications.events import Event, broadcast
from django.utils.translation import gettext_lazy as _

from common.tenancy import without_motel

# El nombre de la ciudad no se traduce; la región que lo acompaña sí, y por eso
# la etiqueta entera pasa por gettext: "Centro (Mérida)" es "Central (Mérida)"
# en inglés, no "Central (Merida City)".
COMMON_TIME_ZONES: tuple[tuple[str, object], ...] = (
    ("America/Mexico_City", _("Centro (Ciudad de México)")),
    ("America/Cancun", _("Sureste (Cancún)")),
    ("America/Merida", _("Centro (Mérida)")),
    ("America/Monterrey", _("Centro (Monterrey)")),
    ("America/Matamoros", _("Frontera (Matamoros)")),
    ("America/Chihuahua", _("Pacifico (Chihuahua)")),
    ("America/Ciudad_Juarez", _("Frontera (Ciudad Juárez)")),
    ("America/Mazatlan", _("Pacifico (Mazatlán)")),
    ("America/Hermosillo", _("Pacifico (Hermosillo)")),
    ("America/Tijuana", _("Noroeste (Tijuana)")),
    ("America/Bahia_Banderas", _("Centro (Bahía de Banderas)")),
    ("UTC", _("UTC")),
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

        # Sin sucursal identificada, marca del producto y no la de un negocio.
        #
        # Antes esto caía en `Motel.defaults()`, que toma el nombre de la
        # variable `BUSINESS_NAME`: en un despliegue con varios negocios esa
        # variable lleva el de uno solo, y la pantalla de acceso se presentaba
        # con él ante cualquiera que llegara sin sesión. Cerrar sesión no lo
        # arreglaba porque el nombre no estaba en el navegador, venía de aquí en
        # cada carga.
        if motel is None:
            motel = Motel.neutral()

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
                {"error": {"code": "no_motel", "message": "Tu usuario no pertenece a una sucursal."}},
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


class RegistroPublicoView(APIView):
    """Alta de autoservicio: el negocio crea su sucursal y entra de una vez.

    Es el único endpoint que crea datos sin sesión, así que va cerrado por
    fuera: ``PUBLIC_SIGNUP_ENABLED`` lo apaga sin desplegar y el throttle por
    IP evita que alguien llene la base de sucursales vacías.

    Devuelve el mismo par de tokens que ``/auth/login/`` para que la terminal
    no tenga que volver a pedir la contraseña que acaba de escribir. Con la
    sesión ya puesta, el asistente de configuración aparece solo: le faltan
    los cuatro pasos y es lo primero que ve quien acaba de registrarse.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "signup"

    @extend_schema(
        operation_id="settings_public_signup",
        request=RegistroPublicoSerializer,
        responses={
            201: OpenApiResponse(description="Sucursal creada y sesión iniciada"),
            403: OpenApiResponse(description="El registro público está cerrado"),
        },
    )
    def post(self, request) -> Response:
        if not django_settings.PUBLIC_SIGNUP_ENABLED:
            return Response(
                {
                    "error": {
                        "code": "signup_cerrado",
                        "message": "El registro público está deshabilitado.",
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = RegistroPublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        clave = serializer.clave_de_empleado()
        intento = (datos.get("attempt_key") or "").strip()[:64]

        # Ya se creó con esta misma clave: se devuelve la sesión de aquella
        # organización en vez de crear otra. Es el caso del doble clic y el de
        # la respuesta que se perdió en el camino.
        if intento:
            previo = SignupAttempt.objects.filter(key=intento).select_related("motel").first()
            if previo is not None:
                dueño = User.all_objects.filter(motel=previo.motel, username=clave).first()
                if dueño is not None:
                    return self._sesion(dueño, status.HTTP_200_OK)

        # El correo ya dio de alta un negocio. Crear otro dejaría dos
        # organizaciones con la misma clave de empleado -- que se deriva del
        # correo -- y al entrar sin decir la sucursal el sistema no sabría a
        # cuál de las dos. Es más útil mandarlo a entrar que duplicarle el
        # negocio en silencio.
        if User.all_objects.filter(email__iexact=datos["email"], motel__isnull=False).exists():
            return Response(
                {
                    "error": {
                        "code": "email_ya_registrado",
                        "message": (
                            "Ese correo ya dio de alta un negocio. Entra con tu clave, "
                            "o usa otro correo si vas a abrir uno distinto."
                        ),
                        "details": {},
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Sin motel en el contexto: la sucursal se está creando en este momento
        # y el manager de usuarios acota por el motel en curso, que aquí no hay.
        with without_motel():
            motel = services.create_motel(
                name=datos["business_name"],
                email=datos["email"],
                phone=datos["phone"],
                operation_size=datos["operation_size"],
                owner_username=clave,
                owner_full_name=datos["admin_full_name"],
                owner_password=datos["password"],
                owner_email=datos["email"],
                owner_phone=datos["phone"],
            )
            owner = User.all_objects.get(motel=motel, username=clave)
            if intento:
                # La restricción única es la que de verdad protege: dos altas
                # simultáneas con la misma clave chocan aquí y la segunda
                # deshace su transacción entera, motel incluido.
                SignupAttempt.objects.create(key=intento, motel=motel)

        return self._sesion(owner, status.HTTP_201_CREATED)

    @staticmethod
    def _sesion(owner, codigo: int) -> Response:
        """El par de tokens con el que la terminal entra sin volver a preguntar."""
        refresh = MotelTokenObtainPairSerializer.get_token(owner)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(owner).data,
            },
            status=codigo,
        )
