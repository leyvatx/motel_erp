from django.apps import AppConfig


class HousekeepingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.housekeeping"
    label = "housekeeping"
    verbose_name = "Ama de llaves"

    def ready(self) -> None:
        from apps.housekeeping import receivers
