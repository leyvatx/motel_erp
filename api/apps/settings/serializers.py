"""Serializadores del motel: su marca, sus parametros y su alta."""

from __future__ import annotations

import zoneinfo

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import FileExtensionValidator
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.settings.constants import LOGO_EXTENSIONS, LOGO_MAX_BYTES, OperationSize
from apps.settings.models import Motel
from common.tenancy import without_motel


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
            # El asistente de alta lo lee para proponer cuántas habitaciones
            # crear, en vez de volver a preguntar lo que ya se contestó al
            # registrarse.
            "operation_size",
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
            raise serializers.ValidationError(_("El nombre del negocio no puede quedar vacio."))
        return nombre

    def validate_currency(self, value: str) -> str:
        codigo = value.strip().upper()
        if len(codigo) != 3 or not codigo.isalpha():
            raise serializers.ValidationError(_("Usa el código ISO de tres letras, por ejemplo MXN o USD.")
            )
        return codigo

    def validate_time_zone(self, value: str) -> str:
        try:
            zoneinfo.ZoneInfo(value)
        except Exception as exc:
            raise serializers.ValidationError(_("Zona horaria desconocida. Usa el formato «America/Mexico_City».")
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
        """El motel nace vacío, así que la clave del dueño solo se normaliza.

        Que otro motel ya tenga un dueño con el mismo nombre no estorba: cada
        uno entra indicando el suyo.
        """
        return value.strip().lower()

    def validate_time_zone(self, value: str) -> str:
        try:
            zoneinfo.ZoneInfo(value)
        except Exception as exc:
            raise serializers.ValidationError(_("Zona horaria desconocida.")) from exc
        return value


class TimeZoneOptionSerializer(serializers.Serializer):
    """Zona horaria para el selector de la pantalla de configuración."""

    value = serializers.CharField()
    label = serializers.CharField()


class RegistroPublicoSerializer(serializers.Serializer):
    """Alta de autoservicio: lo mínimo para que un negocio empiece a operar.

    Solo se piden cuatro cosas. Todo lo demás -- zona horaria, moneda, colores,
    tarifas -- trae valor por omisión y se ajusta después en el asistente: pedir
    quince campos antes de dejar entrar es la forma más segura de que nadie
    termine el registro.

    La clave de empleado no se pregunta: se deriva del correo. Quien se registra
    todavía no sabe que este sistema entra con clave y no con correo, y explicarlo
    en el formulario cuesta más que resolverlo aquí.
    """

    business_name = serializers.CharField(max_length=120, label="Nombre del negocio")
    admin_full_name = serializers.CharField(max_length=150, label="Nombre del administrador")
    email = serializers.EmailField(label="Correo")
    username = serializers.CharField(max_length=40, label="Nombre de usuario")
    phone = serializers.CharField(max_length=20, label="Teléfono de contacto")
    operation_size = serializers.ChoiceField(
        choices=OperationSize.choices, label="Tamaño de la operación"
    )
    password = serializers.CharField(min_length=8, write_only=True, label="Contraseña")
    # La genera el navegador una vez por intento de alta. Opcional para no
    # romper a un cliente viejo, pero sin ella se pierde la protección contra
    # crear dos organizaciones por un reintento.
    attempt_key = serializers.CharField(required=False, allow_blank=True, max_length=64)

    def validate_business_name(self, value: str) -> str:
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError(_("Escribe el nombre del negocio."))
        return nombre

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_username(self, value: str) -> str:
        """Forma de la clave con la que va a entrar todos los días.

        Aquí solo el formato. Que no choque con nadie se revisa en `validate`,
        donde ya se sabe si esto es un alta nueva o el reintento de una que ya
        se hizo -- y en el reintento, chocar consigo mismo es lo esperado.
        """
        from apps.users.models import username_validator

        clave = value.strip().lower()
        if not clave:
            raise serializers.ValidationError(_("Escribe un nombre de usuario."))

        try:
            username_validator(clave)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc

        return clave

    def validate_phone(self, value: str) -> str:
        """Un teléfono al que de verdad se pueda marcar.

        No se impone formato -- hay lada, extensión, prefijo de país y todos son
        legítimos -- pero sí que tenga dígitos suficientes para ser un número.
        """
        telefono = " ".join(value.split())
        digitos = sum(caracter.isdigit() for caracter in telefono)
        if digitos < 8:
            raise serializers.ValidationError(_("Escribe un teléfono completo, con lada.")
            )
        return telefono

    def validate(self, attrs: dict) -> dict:
        """La contraseña se revisa aquí y no campo por campo.

        Es la única contraseña del sistema que se elige sin que nadie del lado
        del cliente supervise, y va a ser la del dueño: la cuenta con más
        permisos de esa sucursal. Por eso pasa por los validadores de Django y
        no por un mínimo de longitud.

        Va en la validación de objeto porque ``UserAttributeSimilarityValidator``
        necesita al usuario para comparar: sin él no hace nada, y "efrain2024"
        con el correo ``efrain2024@...`` pasaría como si fuera una contraseña.
        Aquí ya están el nombre y el correo, que es contra lo que compara.

        Los mensajes salen de Django y llegan en español porque ``LANGUAGE_CODE``
        es ``es-mx`` y no hay ``LocaleMiddleware`` que deje al navegador
        cambiarlo. Se devuelven bajo la llave ``password`` para que el
        formulario los pinte debajo de su campo y no en un aviso suelto.
        """
        from django.contrib.auth.password_validation import validate_password

        from apps.settings.models import SignupAttempt
        from apps.users.models import User

        # Una clave única en toda la plataforma, no solo dentro de la sucursal.
        #
        # Al entrar sin decir a qué negocio pertenece, el sistema resuelve la
        # sucursal por la clave; una repetida obliga a preguntar cuál de las dos
        # es, con un dato que a quien acaba de registrarse nadie le dio.
        #
        # El reintento se exceptúa a propósito: el navegador reenvía el alta con
        # la misma clave de intento cuando la respuesta se perdió, y esa segunda
        # llamada choca contra el usuario que ella misma creó. Rechazarla ahí
        # convertía la protección contra duplicados en un "ese nombre ya está
        # tomado" para el dueño legítimo, sin manera de salir.
        intento = (attrs.get("attempt_key") or "").strip()[:64]
        es_reintento = bool(intento) and SignupAttempt.objects.filter(key=intento).exists()

        if not es_reintento:
            with without_motel():
                if User.all_objects.filter(username=attrs["username"]).exists():
                    raise serializers.ValidationError(
                        {
                            "username": [
                                "Ese nombre de usuario ya está tomado. Prueba con otro."
                            ]
                        }
                    )

        candidato = User(
            username=attrs["username"],
            full_name=attrs["admin_full_name"],
            email=attrs["email"],
        )

        try:
            validate_password(attrs["password"], user=candidato)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs

    def clave_de_empleado(self) -> str:
        """La que eligió quien se registró.

        Antes se derivaba del correo, porque el formulario no la preguntaba y
        había que inventar algo con lo que entrar. Ahora se pregunta: la persona
        sabe con qué va a entrar mañana en lugar de descubrirlo en el correo de
        bienvenida. ``clave_desde_correo`` sigue existiendo para las altas que
        no pasan por este formulario.
        """
        return self.validated_data["username"]


def clave_desde_correo(email: str) -> str:
    """Clave de empleado derivada del correo, ajustada al validador de ``User``.

    El validador exige de 3 a 40 caracteres de ``[a-z0-9._-]``. Un correo como
    ``Ana+Ventas@motel.mx`` no pasa tal cual, y uno como ``jr@...`` se queda
    corto.
    """
    import re

    local = email.split("@")[0]
    clave = re.sub(r"[^a-z0-9._-]", "", local.lower())[:40]
    return clave if len(clave) >= 3 else "admin"
