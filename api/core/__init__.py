"""Paquete de configuración del proyecto.

Se importa la app de Celery al arrancar Django para que el decorador
``@shared_task`` quede siempre ligado a la instancia correcta.
"""

from core.celery import app as celery_app

__all__ = ("celery_app",)
