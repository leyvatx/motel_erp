from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    label = "notifications"
    verbose_name = "Notificaciones y tiempo real"

    def ready(self) -> None:
        # Conecta las señales de dominio con el bus de eventos en tiempo real.
        from apps.notifications import receivers  # noqa: F401
