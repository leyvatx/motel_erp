from django.apps import AppConfig


class RoomsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rooms"
    label = "rooms"
    verbose_name = "Habitaciones y rentas"

    def ready(self) -> None:
        # Registra las señales de dominio (cambio de estado -> limpieza, eventos WS).
        from apps.rooms import signals  # noqa: F401
