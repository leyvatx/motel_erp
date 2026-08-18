from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from core.celery import app as celery_app


class Command(BaseCommand):
    help = "Comprueba PostgreSQL, Redis/Channels y el broker de Celery."

    def handle(self, *args, **options):
        failures = []

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            self.stdout.write(self.style.SUCCESS("PostgreSQL: OK"))
        except Exception as exc:
            failures.append(f"PostgreSQL: {exc}")

        try:
            layer = get_channel_layer()
            if layer is None:
                raise RuntimeError("No hay channel layer configurado")
            channel = async_to_sync(layer.new_channel)("runtime.check")
            async_to_sync(layer.send)(channel, {"type": "runtime.check", "value": "ok"})
            message = async_to_sync(layer.receive)(channel)
            if message.get("value") != "ok":
                raise RuntimeError("Respuesta inesperada del channel layer")
            self.stdout.write(self.style.SUCCESS("Redis/Channels: OK"))
        except Exception as exc:
            failures.append(f"Redis/Channels: {exc}")

        try:
            with celery_app.connection_for_write() as broker:
                broker.ensure_connection(max_retries=1, timeout=3)
            self.stdout.write(self.style.SUCCESS("Broker Celery: OK"))
        except Exception as exc:
            failures.append(f"Broker Celery: {exc}")

        if failures:
            raise CommandError("\n".join(failures))

        self.stdout.write(self.style.SUCCESS("Infraestructura operativa."))
