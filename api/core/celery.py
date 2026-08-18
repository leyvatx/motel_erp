
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("motel_erp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

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
}


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    print(f"Request: {self.request!r}")
