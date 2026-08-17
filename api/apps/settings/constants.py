"""Catalogos de la configuración del negocio."""

from django.db import models


class PrinterBackend(models.TextChoices):
    """Cómo se entrega el ticket a la impresora termica."""

    DUMMY = "dummy", "Sin impresora (solo registra)"
    NETWORK = "network", "Impresora de red"
    USB = "usb", "Impresora USB"
    FILE = "file", "Archivo de texto"


LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]

LOGO_MAX_BYTES = 512 * 1024
