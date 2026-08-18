"""Serializadores del motel: su marca, sus parametros y su alta."""

from __future__ import annotations

import zoneinfo

from django.core.validators import FileExtensionValidator
from rest_framework import serializers

from apps.settings.constants import LOGO_EXTENSIONS, LOGO_MAX_BYTES
from apps.settings.models import Motel


def logo_url(motel: Motel) -> str | None:
    """URL del logotipo, normalizada a ruta absoluta del sitio.

    Se devuelve relativa a proposito (``/media/branding/...``): así funciona
    igual detras del proxy de Vite en desarrollo y del servidor web en
    producción. Si ``MEDIA_URL`` apunta a un almacenamiento externo, la URL ya
    viene completa y se respeta tal cual.
    """
    if not motel.logo:
        return None

    url = motel.logo.url
    if url.startswith(("http://", "https://", "/")):
        return url
    return f"/{url}"


class LogoField(serializers.FileField):
    """Logotipo con tope de peso: viaja en cada carga de la pantalla de acceso.

    Declarar el campo a mano descarta los validadores que el modelo trae, así
    que la lista de extensiones se vuelve a colgar aquí de forma explicita.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("validators", [FileExtensionValidator(LOGO_EXTENSIONS)])
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        archivo = super().to_internal_value(data)
        if archivo.size > LOGO_MAX_BYTES:
            raise serializers.ValidationError(
                f"La imagen pesa {archivo.size // 1024} KB; el limite es "
                f"{LOGO_MAX_BYTES // 1024} KB."
            )
        return archivo


class PublicMotelSerializer(serializers.ModelSerializer):
    """Lo que puede ver alguien que todavia no inicia sesión.

    Solo la marca y el formato regional: la pantalla de acceso necesita saber
    cómo se llama el motel, no cual es su RFC ni donde esta la impresora.
    """

    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Motel
        fields = (
            "slug", "name", "logo_url", "currency", "locale", "time_zone",
            "brand_primary_color", "brand_sidebar_color", "status_available_color",
            "status_occupied_color", "status_cleaning_color", "status_maintenance_color",
            "default_theme", "default_density", "border_radius", "font_family", "login_message",
        )
        read_only_fields = fields

    def get_logo_url(self, motel: Motel) -> str | None:
        return logo_url(motel)


class MotelSerializer(serializers.ModelSerializer):
    """Perfil completo. Lo lee cualquier empleado; lo escribe gerencia."""

    logo = LogoField(required=False, allow_null=True)
    logo_url = serializers.SerializerMethodField()
    printer_backend_display = serializers.CharField(
        source="get_printer_backend_display", read_only=True
    )

    class Meta:
        model = Motel
        fields = (
            "id",
            "slug",
            "name",
            "legal_name",
            "tax_id",
            "address",
            "phone",
            "email",
            "logo",
            "logo_url",
            "brand_primary_color",
            "brand_sidebar_color",
            "status_available_color",
            "status_occupied_color",
            "status_cleaning_color",
            "status_maintenance_color",
            "default_theme",
            "default_density",
            "border_radius",
            "font_family",
            "login_message",
            "currency",
            "locale",
            "time_zone",
            "ticket_footer",
            "print_ticket_on_close",
            "expiration_warning_minutes",
            "expense_approval_threshold",
            "printer_backend",
            "printer_backend_display",
            "printer_host",
            "printer_port",
            "is_active",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "logo_url", "printer_backend_display", "is_active",
                            "updated_at")
        extra_kwargs = {"logo": {"write_only": True}}

    def get_logo_url(self, motel: Motel) -> str | None:
        return logo_url(motel)

    def validate_name(self, value: str) -> str:
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError("El nombre del negocio no puede quedar vacio.")
        return nombre

    def validate_currency(self, value: str) -> str:
        codigo = value.strip().upper()
        if len(codigo) != 3 or not codigo.isalpha():
            raise serializers.ValidationError(
                "Usa el código ISO de tres letras, por ejemplo MXN o USD."
            )
        return codigo

    def validate_time_zone(self, value: str) -> str:
        try:
            zoneinfo.ZoneInfo(value)
        except Exception as exc:
            raise serializers.ValidationError(
                "Zona horaria desconocida. Usa el formato «America/Mexico_City»."
            ) from exc
        return value

    def validate(self, attrs: dict) -> dict:
        color_fields = (
            "brand_primary_color",
            "brand_sidebar_color",
            "status_available_color",
            "status_occupied_color",
            "status_cleaning_color",
            "status_maintenance_color",
        )
        for field in color_fields:
            if field in attrs:
                attrs[field] = attrs[field].upper()
        backend = attrs.get("printer_backend", getattr(self.instance, "printer_backend", None))
        host = attrs.get("printer_host", getattr(self.instance, "printer_host", ""))
        if backend == "network" and not host:
            raise serializers.ValidationError(
                {"printer_host": "Una impresora de red necesita su dirección IP."}
            )
        return attrs

    def update(self, instance: Motel, validated_data: dict) -> Motel:
        if "logo" in validated_data and instance.logo:
            instance.logo.delete(save=False)

        actor = self.context["request"].user
        instance.updated_by = actor if actor.is_authenticated else None
        return super().update(instance, validated_data)


class MotelListSerializer(serializers.ModelSerializer):
    """Resumen de cada motel para el tablero de la plataforma."""

    logo_url = serializers.SerializerMethodField()
    user_count = serializers.IntegerField(read_only=True)
    room_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Motel
        fields = (
            "id",
            "slug",
            "name",
            "logo_url",
            "address",
            "phone",
            "currency",
            "time_zone",
            "is_active",
            "user_count",
            "room_count",
            "created_at",
        )
        read_only_fields = fields

    def get_logo_url(self, motel: Motel) -> str | None:
        return logo_url(motel)


class MotelCreateSerializer(serializers.ModelSerializer):
    """Alta de un motel con su primer usuario dueño."""

    owner_username = serializers.CharField(max_length=40, write_only=True)
    owner_full_name = serializers.CharField(max_length=150, write_only=True)
    owner_password = serializers.CharField(min_length=8, write_only=True)

    class Meta:
        model = Motel
        fields = (
            "name",
            "legal_name",
            "tax_id",
            "address",
            "phone",
            "email",
            "currency",
            "locale",
            "time_zone",
            "owner_username",
            "owner_full_name",
            "owner_password",
        )

    def validate_owner_username(self, value: str) -> str:
        from apps.users.models import User

        username = value.strip().lower()
        if User.all_objects.filter(username=username).exists():
            raise serializers.ValidationError("Ese usuario ya existe.")
        return username

    def validate_time_zone(self, value: str) -> str:
        try:
            zoneinfo.ZoneInfo(value)
        except Exception as exc:
            raise serializers.ValidationError("Zona horaria desconocida.") from exc
        return value


class TimeZoneOptionSerializer(serializers.Serializer):
    """Zona horaria para el selector de la pantalla de configuración."""

    value = serializers.CharField()
    label = serializers.CharField()
