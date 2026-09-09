"""Serializadores de autenticación y administración de usuarios."""

from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.utils import datetime_from_epoch

from apps.settings.models import Motel
from apps.users import sessions
from apps.users.constants import Role
from apps.users.models import User, UserSession
from common.exceptions import DomainError
from common.tenancy import current_motel_id, use_motel


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    motel_name = serializers.CharField(source="motel.name", read_only=True, default=None)
    motel_slug = serializers.CharField(source="motel.slug", read_only=True, default=None)
    is_platform_admin = serializers.BooleanField(read_only=True)
    is_corporate_user = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "phone",
            "role",
            "role_display",
            "motel",
            "motel_name",
            "motel_slug",
            "is_platform_admin",
            "is_corporate_user",
            "employee_number",
            "hired_at",
            "is_active",
            "is_staff",
            "must_change_password",
            "last_login",
            "created_at",
        )
        read_only_fields = (
            "id",
            "motel",
            "last_login",
            "created_at",
            "is_staff",
            "is_platform_admin",
            "is_corporate_user",
        )


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "phone",
            "role",
            "employee_number",
            "hired_at",
            "password",
            "must_change_password",
        )

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_username(self, value: str) -> str:
        """La clave solo tiene que ser única dentro del motel que la usa.

        El motel sale del contexto y no del usuario: una cuenta corporativa
        no tiene motel propio y opera sobre el que trae seleccionado.
        """
        username = value.strip().lower()
        motel_id = self.instance.motel_id if self.instance is not None else current_motel_id()
        repetido = User.all_objects.filter(motel_id=motel_id, username=username)
        if self.instance is not None:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError("Ese usuario ya existe en esta sucursal.")
        return username

    def validate(self, attrs: dict) -> dict:
        instance = self.instance
        if (
            instance is not None
            and instance.role == Role.SUPERADMIN
            and attrs.get("role", instance.role) != Role.SUPERADMIN
            and not User.all_objects.filter(
                motel_id=instance.motel_id,
                role=Role.SUPERADMIN,
                is_active=True,
            ).exclude(pk=instance.pk).exists()
        ):
            raise serializers.ValidationError(
                {"role": "La sucursal debe conservar al menos un super administrador activo."}
            )
        return attrs

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance: User, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = False
        instance.save()
        return instance


class MotelTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Resuelve el motel del acceso y agrega el perfil a la respuesta.

    La clave de empleado se repite entre moteles, así que la terminal manda
    el identificador del suyo y la búsqueda se acota a él. Cuando no lo manda
    -- una instalación de un solo motel, la cuenta de plataforma, un cliente
    de API -- se resuelve sola mientras la clave no exista en dos lugares.
    """

    motel = serializers.CharField(
        required=False, allow_blank=True, write_only=True, max_length=140,
        help_text="Identificador de la sucursal. Solo hace falta si la clave se repite.",
    )

    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        # La sesión nace aquí porque es el único punto donde se conocen la IP y
        # el navegador. El sid viaja dentro del refresh y simplejwt lo copia a
        # cada access token que derive de él, también después de rotar: por eso
        # una petición cualquiera puede saber a qué sesión pertenece.
        sesion = sessions.abrir(user)
        token[sessions.CLAVE_SESION] = str(sesion.sid)
        sessions.renovar(
            sesion.sid,
            token[jwt_settings.JTI_CLAIM],
            datetime_from_epoch(token["exp"]),
        )
        return token

    def validate(self, attrs: dict) -> dict:
        slug = (attrs.pop("motel", "") or "").strip()
        identificador = (attrs.get(self.username_field) or "").strip().lower()
        attrs[self.username_field] = identificador

        with use_motel(self._resolve_motel_id(identificador, slug)):
            data = super().validate(attrs)

        data["user"] = UserSerializer(self.user).data
        return data

    def _resolve_motel_id(self, identificador: str, slug: str) -> int | None:
        """De qué sucursal es quien está entrando.

        El identificador puede ser la clave de empleado o el correo: quien dio
        de alta el negocio se registró con su correo y es lo único que recuerda.
        Se busca por los dos porque este paso ocurre *antes* de autenticar, y si
        aquí no se acierta el motel, el manager acotado no encuentra a nadie
        después -- por muy correcta que sea la contraseña.
        """
        if slug:
            motel_id = (
                Motel.objects.filter(slug__iexact=slug).values_list("pk", flat=True).first()
            )
            if motel_id is None:
                raise DomainError(
                    "Esa sucursal no existe o está suspendida.", code="motel_desconocido"
                )
            return motel_id

        if not identificador:
            return None

        candidatos = list(
            User.objects.filter(
                Q(username=identificador) | Q(email__iexact=identificador)
            )
            .values_list("motel_id", flat=True)
            .distinct()[:2]
        )
        if len(candidatos) > 1:
            raise DomainError(
                "Ese dato se usa en varias sucursales. Indica cuál es la tuya.",
                code="motel_requerido",
            )
        return candidatos[0] if candidatos else None


class MotelTokenRefreshSerializer(TokenRefreshSerializer):
    """Renueva el acceso sin reventar cuando el usuario ya no puede entrar.

    El serializador de simplejwt busca al dueño del token con
    ``get_user_model().objects.get(...)``, y el manager por omisión de este
    proyecto filtra ``is_active=True`` además del motel. Un empleado dado de
    baja no falla la regla de autenticación que simplejwt trae para responder
    401: desaparece antes, y el ``DoesNotExist`` sale como 500. El frontend lee
    ese 500 como "el servidor tiene problemas" -- con razón -- y conserva la
    sesión, así que el operador se queda dando vueltas en una pantalla que ya
    no puede usar.

    Aquí se traduce esa ausencia a un token inválido, que es lo que de verdad
    pasó, y el navegador ya sabe qué hacer con eso: limpiar y mandar al acceso.
    """

    def validate(self, attrs: dict) -> dict:
        sid = self._sid(attrs.get("refresh", ""))
        if sid is not None and sessions.esta_revocada(sid):
            raise InvalidToken("Esta sesión se cerró desde otro equipo.")

        try:
            data = super().validate(attrs)
        except User.DoesNotExist as exc:
            raise InvalidToken("Tu cuenta ya no está activa. Pide que la reactiven.") from exc

        if sid is not None:
            self._renovar(sid, data.get("refresh") or attrs["refresh"])
        return data

    def _sid(self, raw: str):
        """Lee el identificador de sesión sin opinar sobre el resto del token.

        Un token corrupto devuelve ``None`` para que la validación de arriba lo
        rechace con su propio mensaje, que es más preciso que cualquiera que se
        pudiera inventar aquí.
        """
        try:
            return self.token_class(raw).payload.get(sessions.CLAVE_SESION)
        except Exception:
            return None

    def _renovar(self, sid, raw: str) -> None:
        try:
            payload = self.token_class(raw).payload
        except Exception:
            return
        sessions.renovar(sid, payload[jwt_settings.JTI_CLAIM], datetime_from_epoch(payload["exp"]))


class UserSessionSerializer(serializers.ModelSerializer):
    """Una sesión como la lee un humano, no como la guarda simplejwt."""

    user_username = serializers.CharField(source="user.username", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    user_role_display = serializers.CharField(source="user.get_role_display", read_only=True)
    device = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = (
            "sid",
            "user",
            "user_username",
            "user_full_name",
            "user_role_display",
            "ip_address",
            "user_agent",
            "device",
            "created_at",
            "last_seen_at",
            "expires_at",
            "is_current",
        )
        read_only_fields = fields

    def get_is_current(self, obj: UserSession) -> bool:
        return str(obj.sid) == str(self.context.get("sid_actual"))

    def get_device(self, obj: UserSession) -> str:
        """Navegador y sistema en dos palabras.

        El user agent completo se manda igual por si hace falta el detalle,
        pero nadie distingue dos sesiones leyendo cien caracteres de cadena.
        """
        agente = obj.user_agent or ""
        navegador = next(
            (nombre for marca, nombre in NAVEGADORES if marca in agente), "Navegador"
        )
        sistema = next((nombre for marca, nombre in SISTEMAS if marca in agente), "")
        return f"{navegador} en {sistema}" if sistema else navegador


# El orden importa: Edge y Opera se anuncian también como Chrome, y Chrome se
# anuncia como Safari. Gana el primero que coincide.
NAVEGADORES = (
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"),
    ("Safari/", "Safari"),
)

SISTEMAS = (
    ("Windows", "Windows"),
    ("Android", "Android"),
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Mac OS", "macOS"),
    ("Linux", "Linux"),
)


class PermissionOptionSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    group = serializers.CharField()


class RoleMatrixRoleSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField())


class RoleMatrixSerializer(serializers.Serializer):
    """La matriz completa: qué puede hacer cada rol.

    Vive en código, no en base de datos, y la pantalla lo dice. Se expone aparte
    del catálogo de roles para no cambiarle la forma a ``/auth/roles/``, que el
    desplegable de alta de usuarios ya consume como lista simple.
    """

    roles = RoleMatrixRoleSerializer(many=True)
    permissions = PermissionOptionSerializer(many=True)


class UserPresenceSerializer(serializers.Serializer):
    """Estado de conexión de un compañero de turno."""

    user_id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    full_name = serializers.CharField(source="user.full_name")
    role = serializers.CharField(source="user.role")
    role_display = serializers.CharField(source="user.get_role_display")
    is_online = serializers.BooleanField()
    last_seen_at = serializers.DateTimeField(allow_null=True)
    last_section = serializers.CharField(allow_blank=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_current_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value


class RoleOptionSerializer(serializers.Serializer):
    """Catalogo de roles para los selectores del frontend."""

    value = serializers.ChoiceField(choices=Role.choices)
    label = serializers.CharField()


class WsTicketSerializer(serializers.Serializer):
    """Boleto de un solo uso para el handshake del WebSocket."""

    ticket = serializers.CharField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)
