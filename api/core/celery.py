"""Celery: calendario de tareas periódicas y reparto en colas.

La impresión va en su propia cola y la atiende su propio worker. Una térmica
apagada tarda diez segundos en fallar y reintenta tres veces; si eso viviera en
la cola general, cincuenta moteles imprimiendo contra impresoras muertas se
comerían la concurrencia y retrasarían ``sweep_stay_timers``, que corre cada
treinta segundos y es de donde recepción saca los cronómetros. Un ticket que no
sale es una molestia; un cronómetro detenido es la pantalla principal mintiendo.
"""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("motel_erp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.task_default_queue = "celery"
app.conf.task_routes = {
    "apps.sales.tasks.print_receipt": {"queue": "printing"},
}

app.conf.beat_schedule = {
    "sweep-expiring-stays": {
        "task": "apps.rooms.tasks.dispatch_stay_timer_sweeps",
        "schedule": 30.0,
        "options": {"expires": 25},
    },
    "expire-stale-reservations": {
        "task": "apps.rooms.tasks.dispatch_reservation_expirations",
        "schedule": crontab(minute="*/10"),
    },
    "check-low-stock": {
        "task": "apps.inventory.tasks.dispatch_low_stock_checks",
        "schedule": crontab(minute="*/15"),
    },
    "check-expiring-lots": {
        "task": "apps.inventory.tasks.dispatch_expiring_lot_checks",
        "schedule": crontab(hour=7, minute=0),
    },
    "flush-expired-tokens": {
        "task": "apps.users.tasks.flush_expired_tokens",
        "schedule": crontab(hour=3, minute=30),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    print(f"Request: {self.request!r}")
