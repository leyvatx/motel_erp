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
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cuánto se conserva una sesión ya muerta. No es historial de auditoría -- eso
# vive en UserActivity, que no se toca -- sino el rastro que permite explicar
# "esto lo cerró gerencia el martes" mientras la pregunta sigue siendo reciente.
DIAS_DE_SESIONES_MUERTAS = 30


@shared_task(name="apps.users.tasks.flush_expired_tokens", ignore_result=True)
def flush_expired_tokens() -> None:
    """Borra los tokens vencidos y las sesiones que ya no explican nada."""
    from apps.users.models import UserSession

    call_command("flushexpiredtokens")

    corte = timezone.now() - timezone.timedelta(days=DIAS_DE_SESIONES_MUERTAS)
    muertas = UserSession.objects.filter(revoked_at__lt=corte) | UserSession.objects.filter(
        revoked_at__isnull=True, expires_at__lt=corte
    )
    borradas, _ = muertas.delete()

    logger.info(
        "Tokens vencidos purgados de la lista negra; %s sesiones viejas borradas.", borradas
    )
