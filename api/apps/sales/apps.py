from django.apps import AppConfig


class SalesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sales"
    label = "sales"
    verbose_name = "Ventas y folios"

    def ready(self) -> None:
        # Emisión automática del ticket al cerrar la cuenta.
        from apps.sales import receivers  # noqa: F401
