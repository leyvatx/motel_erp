"""Catalogos de la configuración del negocio."""

from django.db import models


class PrinterBackend(models.TextChoices):
    """Cómo se entrega el ticket a la impresora termica."""

    DUMMY = "dummy", "Sin impresora (solo registra)"
    NETWORK = "network", "Impresora de red"
    USB = "usb", "Impresora USB"
    FILE = "file", "Archivo de texto"


class OperationSize(models.TextChoices):
    """De qué tamaño es la operación que se está dando de alta.

    Se pregunta una sola vez, en el registro, y sirve para dos cosas: saber a
    quién se le está entregando el sistema, y llegar al asistente de alta con
    una cifra ya propuesta en vez de una casilla vacía. No es un límite: quien
    dice "1 a 10" puede dar de alta cuarenta el mismo día.
    """

    HASTA_10 = "1-10", "1-10 cuartos"
    HASTA_30 = "11-30", "11-30 cuartos"
    HASTA_50 = "31-50", "31-50 cuartos"
    MAS_DE_50 = "50+", "Más de 50 cuartos"


#: Cuántas habitaciones proponer en el asistente para cada tamaño. Es el número
#: con el que la mayoría de esa franja termina, no el tope: sobra menos trabajo
#: corregir hacia arriba que borrar de más.
CUARTOS_SUGERIDOS: dict[str, int] = {
    OperationSize.HASTA_10: 10,
    OperationSize.HASTA_30: 20,
    OperationSize.HASTA_50: 40,
    OperationSize.MAS_DE_50: 60,
}

LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]

LOGO_MAX_BYTES = 512 * 1024
