from django.apps import AppConfig


class HousekeepingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.housekeeping"
    label = "housekeeping"
    verbose_name = "Ama de llaves"

    def ready(self) -> None:
        # Alta automática de la tarea de limpieza al liberarse un cuarto.
        from apps.housekeeping import receivers  # noqa: F401
