"""El motel: identidad, parametros de operación y dueño de todos los datos.

Un mismo servidor atiende a varios moteles. Este modelo es la raiz de esa
separación: cada habitación, cada turno de caja y cada usuario cuelgan de un
renglón de esta tabla, y los managers de ``common`` acotan solas las consultas
al motel de quien pregunta.

Las variables de entorno siguen existiendo, pero solo como semilla del primer
motel; a partir de ahí la verdad es la base de datos, editable desde la
pantalla de configuración sin reiniciar el servidor.
"""

from __future__ import annotations

import zoneinfo
from decimal import Decimal

from django.conf import settings as django_settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import (
    FileExtensionValidator,
    MaxValueValidator,
    MinValueValidator,
    RegexValidator,
)
from django.db import models
from django.db.utils import Error as DatabaseError
from django.utils.text import slugify

from apps.settings.constants import LOGO_EXTENSIONS, PrinterBackend
from common.managers import SoftDeleteQuerySet
from common.models import AuthorStampedModel, SoftDeleteModel, TimeStampedModel
from common.tenancy import current_motel_id

CACHE_PREFIX = "settings:motel"
CACHE_TTL_SECONDS = 60
HEX_COLOR = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="Usa un color hexadecimal de seis dígitos, por ejemplo #2563EB.",
)


def _cache_safe(operation, *args, **kwargs):
    """Ejecuta una operación de caché sin dejar que tumbe la petición.

    La caché es un atajo, no una dependencia: vive en Redis, que también
    atiende WebSockets y Celery. Si se cae, recepción tiene que poder seguir
    rentando y cobrando aunque pierda el tiempo real. Un fallo aquí solo
    significa que no hubo valor guardado.
    """
    try:
        return operation(*args, **kwargs)
    except Exception:
        return None


def validate_time_zone(value: str) -> None:
    try:
        zoneinfo.ZoneInfo(value)
    except Exception as exc:
        raise ValidationError(f"«{value}» no es una zona horaria valida.") from exc


class MotelManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """Los moteles no se acotan por motel: son la raiz de la jerarquia."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().filter(is_active=True)


class Motel(TimeStampedModel, AuthorStampedModel, SoftDeleteModel):
    """Un motel dado de alta en la plataforma."""

    name = models.CharField("Nombre comercial", max_length=120)
    slug = models.SlugField("Identificador", max_length=140, unique=True)
    legal_name = models.CharField("Razón social", max_length=160, blank=True)
    tax_id = models.CharField("RFC", max_length=20, blank=True)
    address = models.CharField("Dirección", max_length=255, blank=True)
    phone = models.CharField("Teléfono", max_length=30, blank=True)
    email = models.EmailField("Correo", blank=True)
    logo = models.FileField(
        "Logotipo",
        upload_to="branding/",
        blank=True,
        validators=[FileExtensionValidator(LOGO_EXTENSIONS)],
        help_text="Se usa en el menú, en la pantalla de acceso y como icono de la pestaña.",
    )
    brand_primary_color = models.CharField(
        "Color principal", max_length=7, default="#3B82F6", validators=[HEX_COLOR]
    )
    brand_sidebar_color = models.CharField(
        "Color del menú", max_length=7, default="#0F172A", validators=[HEX_COLOR]
    )
    status_available_color = models.CharField(
        "Color disponible", max_length=7, default="#10B981", validators=[HEX_COLOR]
    )
    status_occupied_color = models.CharField(
        "Color ocupado", max_length=7, default="#EF4444", validators=[HEX_COLOR]
    )
    status_cleaning_color = models.CharField(
        "Color limpieza", max_length=7, default="#F59E0B", validators=[HEX_COLOR]
    )
    status_maintenance_color = models.CharField(
        "Color mantenimiento", max_length=7, default="#6B7280", validators=[HEX_COLOR]
    )
    default_theme = models.CharField(
        "Tema predeterminado",
        max_length=8,
        choices=(("light", "Claro"), ("dark", "Oscuro"), ("system", "Del sistema")),
        default="light",
    )
    default_density = models.CharField(
        "Densidad predeterminada",
        max_length=12,
        choices=(("comfortable", "Cómoda"), ("compact", "Compacta")),
        default="comfortable",
    )
    border_radius = models.CharField(
        "Redondeo de controles",
        max_length=8,
        choices=(("square", "Recto"), ("medium", "Medio"), ("rounded", "Redondeado")),
        default="medium",
    )
    font_family = models.CharField(
        "Tipografía",
        max_length=10,
        choices=(("modern", "Moderna"), ("system", "Del sistema"), ("rounded", "Redondeada")),
        default="modern",
    )
    login_message = models.CharField(
        "Mensaje de acceso",
        max_length=140,
        default="Ingresa con tu clave de empleado para continuar.",
        blank=True,
    )

    currency = models.CharField("Moneda", max_length=3, default="MXN")
    locale = models.CharField("Formato regional", max_length=10, default="es-MX")
    time_zone = models.CharField(
        "Zona horaria",
        max_length=64,
        default="America/Mexico_City",
        validators=[validate_time_zone],
        help_text="Define el corte del día de operación. El servidor sigue guardando en UTC.",
    )

    ticket_footer = models.CharField(
        "Pie del ticket", max_length=160, default="Gracias por su visita", blank=True
    )
    print_ticket_on_close = models.BooleanField("Imprimir al cerrar la cuenta", default=True)

    expiration_warning_minutes = models.PositiveSmallIntegerField(
        "Antelación del aviso de vencimiento (min)",
        default=15,
        validators=[MinValueValidator(1), MaxValueValidator(240)],
    )
    expense_approval_threshold = models.DecimalField(
        "Gasto que requiere aprobación",
        max_digits=12,
        decimal_places=2,
        default=Decimal("1000.00"),
        validators=[MinValueValidator(Decimal("0"))],
    )

    printer_backend = models.CharField(
        "Tipo de impresora",
        max_length=10,
        choices=PrinterBackend.choices,
        default=PrinterBackend.DUMMY,
    )
    printer_host = models.CharField("IP de la impresora", max_length=60, blank=True)
    printer_port = models.PositiveIntegerField(
        "Puerto", default=9100, validators=[MinValueValidator(1), MaxValueValidator(65535)]
    )

    objects = MotelManager()
    all_objects = models.Manager()

    class Meta:
        verbose_name = "Motel"
        verbose_name_plural = "Moteles"
        ordering = ("name",)
        base_manager_name = "all_objects"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._build_slug()
        result = super().save(*args, **kwargs)
        _cache_safe(cache.delete, f"{CACHE_PREFIX}:{self.pk}")
        return result

    def _build_slug(self) -> str:
        base = slugify(self.name)[:120] or "motel"
        candidate = base
        counter = 2
        while type(self).all_objects.filter(slug=candidate).exclude(pk=self.pk).exists():
            candidate = f"{base}-{counter}"
            counter += 1
        return candidate

    @classmethod
    def defaults(cls) -> Motel:
        """Motel sin guardar, armado con las variables de entorno.

        Es el respaldo para cuando todavia no hay ningun motel dado de alta:
        sin esto, cualquier proceso que pida la configuración reventaria.
        """
        return cls(
            name=getattr(django_settings, "BUSINESS_NAME", "Motel"),
            address=getattr(django_settings, "BUSINESS_ADDRESS", ""),
            currency=getattr(django_settings, "BUSINESS_CURRENCY", "MXN"),
            time_zone=getattr(django_settings, "BUSINESS_TIME_ZONE", "America/Mexico_City"),
            ticket_footer=getattr(django_settings, "TICKET_FOOTER", ""),
            print_ticket_on_close=getattr(django_settings, "PRINT_TICKET_ON_FOLIO_CLOSE", True),
            expiration_warning_minutes=getattr(django_settings, "EXPIRATION_WARNING_MINUTES", 15),
            expense_approval_threshold=Decimal(
                str(getattr(django_settings, "EXPENSE_APPROVAL_THRESHOLD", "1000.00"))
            ),
            printer_backend=getattr(django_settings, "PRINTER_BACKEND", PrinterBackend.DUMMY),
            printer_host=getattr(django_settings, "PRINTER_HOST", ""),
            printer_port=getattr(django_settings, "PRINTER_PORT", 9100),
        )

    @classmethod
    def current(cls) -> Motel:
        """Motel de la petición en curso. Nunca levanta.

        Se cachea con vida corta: el ticket, el aviso de vencimiento y cada
        pantalla lo piden, y ninguno necesita enterarse al instante de un
        cambio hecho en otro proceso.
        """
        motel_id = current_motel_id()
        if motel_id is None:
            return cls.defaults()

        key = f"{CACHE_PREFIX}:{motel_id}"
        cached = _cache_safe(cache.get, key)
        if cached is not None:
            return cached

        try:
            motel = cls.all_objects.filter(pk=motel_id).first()
        except DatabaseError:
            return cls.defaults()

        if motel is None:
            return cls.defaults()

        _cache_safe(cache.set, key, motel, CACHE_TTL_SECONDS)
        return motel
