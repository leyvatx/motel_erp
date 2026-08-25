"""Mantenimiento periódico de las sesiones.

``flushexpiredtokens`` es el comando que trae SimpleJWT. Sin él las tablas de
tokens vigentes y en lista negra solo crecen: con la rotación de refresh
encendida cada usuario deja un renglón por cada renovación -- del orden de
cincuenta al día por persona -- y esas mismas tablas se consultan en cada
refresh. Correrlo a diario mantiene plano el costo de renovar sesión.

Va a las tres y media de la mañana en UTC, cerca de las nueve y media de la
noche en el centro de México: el sistema no descansa de madrugada, así que se
elige la hora de menos movimiento en recepción, no la de menos tráfico.
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(name="apps.users.tasks.flush_expired_tokens", ignore_result=True)
def flush_expired_tokens() -> None:
    """Borra de las tablas de SimpleJWT los tokens que ya vencieron."""
    call_command("flushexpiredtokens")
    logger.info("Tokens vencidos purgados de la lista negra.")
