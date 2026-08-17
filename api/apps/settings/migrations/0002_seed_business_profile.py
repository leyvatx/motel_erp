"""Siembra el perfil del negocio con lo que hubiera en el entorno.

Una instalación que ya venia funcionando con ``BUSINESS_NAME`` y compañia en
su ``.env`` no debe notar el cambio: se copia tal cual y de ahí en adelante la
edición es por pantalla.
"""

from decimal import Decimal

from django.conf import settings
from django.db import migrations

SINGLETON_PK = 1


def seed(apps, schema_editor):
    BusinessProfile = apps.get_model("settings", "BusinessProfile")
    if BusinessProfile.objects.exists():
        return

    BusinessProfile.objects.create(
        name=getattr(settings, "BUSINESS_NAME", "Motel") or "Motel",
        address=getattr(settings, "BUSINESS_ADDRESS", ""),
        currency=getattr(settings, "BUSINESS_CURRENCY", "MXN"),
        time_zone=getattr(settings, "BUSINESS_TIME_ZONE", "America/Mexico_City"),
        ticket_footer=getattr(settings, "TICKET_FOOTER", ""),
        print_ticket_on_close=getattr(settings, "PRINT_TICKET_ON_FOLIO_CLOSE", True),
        expiration_warning_minutes=getattr(settings, "EXPIRATION_WARNING_MINUTES", 15),
        expense_approval_threshold=Decimal(
            str(getattr(settings, "EXPENSE_APPROVAL_THRESHOLD", "1000.00"))
        ),
        printer_backend=getattr(settings, "PRINTER_BACKEND", "dummy"),
        printer_host=getattr(settings, "PRINTER_HOST", "") or "",
        printer_port=getattr(settings, "PRINTER_PORT", 9100),
    )


def unseed(apps, schema_editor):
    BusinessProfile = apps.get_model("settings", "BusinessProfile")
    BusinessProfile.objects.filter(pk=SINGLETON_PK).delete()


class Migration(migrations.Migration):
    dependencies = [("settings", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
