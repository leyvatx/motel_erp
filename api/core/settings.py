"""Configuración de Django para el ERP del Motel.

Toda la configuración sensible se lee de variables de entorno (django-environ).
El proyecto corre bajo ASGI (Daphne) para soportar HTTP + WebSockets (Channels).
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DJANGO_CSRF_TRUSTED_ORIGINS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5173"]),
    DB_CONN_MAX_AGE=(int, 60),
    JWT_ACCESS_TOKEN_MINUTES=(int, 30),
    JWT_REFRESH_TOKEN_DAYS=(int, 7),
    BUSINESS_TIME_ZONE=(str, "America/Mexico_City"),
    BUSINESS_CURRENCY=(str, "MXN"),
    EXPIRATION_WARNING_MINUTES=(int, 15),
    EXPENSE_APPROVAL_THRESHOLD=(str, "1000.00"),
)

environ.Env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Seguridad
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-only-insecure-key")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env("DJANGO_CSRF_TRUSTED_ORIGINS")

if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ---------------------------------------------------------------------------
# Aplicaciones
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "channels",
    "django_celery_beat",
    "django_celery_results",
]

LOCAL_APPS = [
    "common",
    "apps.users",
    "apps.rooms",
    "apps.inventory",
    "apps.sales",
    "apps.housekeeping",
    "apps.finances",
    "apps.audit",
    "apps.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Expone el request actual (usuario + IP) al hilo para la auditoría (Fase 6).
    "common.middleware.CurrentRequestMiddleware",
    # Marca actividad del empleado para el panel de presencia.
    "common.middleware.PresenceMiddleware",
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Base de datos
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://motel:motel@localhost:5432/motel_erp",
    ),
}
DATABASES["default"]["CONN_MAX_AGE"] = env("DB_CONN_MAX_AGE")
DATABASES["default"]["ATOMIC_REQUESTS"] = False  # Transacciones explicitas en services.

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Autenticación
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internacionalizacion y tiempo
# El backend SIEMPRE opera y persiste en UTC. BUSINESS_TIME_ZONE se usa solo
# para agrupar reportes por "día de operación" y para la impresión de tickets.
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-mx"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

BUSINESS_TIME_ZONE = env("BUSINESS_TIME_ZONE")
BUSINESS_CURRENCY = env("BUSINESS_CURRENCY")

# ---------------------------------------------------------------------------
# Archivos estaticos y media
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Toda vista valida sesión activa y, además, el permiso concreto que
    # declare en ``required_permissions`` (matriz rol -> acción).
    "DEFAULT_PERMISSION_CLASSES": (
        "common.permissions.IsAuthenticatedActive",
        "common.permissions.HasPermission",
    ),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "reports": "60/min",
    },
    "DATETIME_FORMAT": "iso-8601",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_TOKEN_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Motel ERP API",
    "DESCRIPTION": (
        "API del sistema integral de administración: recepción, inventarios, "
        "ama de llaves, finanzas y auditoría."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "RoomStatusEnum": "apps.rooms.constants.RoomStatus.choices",
        "StayStatusEnum": "apps.rooms.constants.StayStatus.choices",
        "ReservationStatusEnum": "apps.rooms.constants.ReservationStatus.choices",
        "TariffRuleTypeEnum": "apps.rooms.constants.TariffRuleType.choices",
        "PriceModeEnum": "apps.rooms.constants.PriceMode.choices",
        "FolioStatusEnum": "apps.sales.constants.FolioStatus.choices",
        "FolioTypeEnum": "apps.sales.constants.FolioType.choices",
        "ChargeTypeEnum": "apps.sales.constants.ChargeType.choices",
        "OrderStatusEnum": "apps.sales.constants.OrderStatus.choices",
        "OrderTypeEnum": "apps.sales.constants.OrderType.choices",
        "PaymentMethodEnum": "apps.sales.constants.PaymentMethod.choices",
        "PaymentStatusEnum": "apps.sales.constants.PaymentStatus.choices",
        "ReceiptKindEnum": "apps.sales.constants.ReceiptKind.choices",
        "RoleEnum": "apps.users.constants.Role.choices",
        "WarehouseTypeEnum": "apps.inventory.constants.WarehouseType.choices",
        "ProductKindEnum": "apps.inventory.constants.ProductKind.choices",
        "UnitOfMeasureEnum": "apps.inventory.constants.UnitOfMeasure.choices",
        "MovementTypeEnum": "apps.inventory.constants.MovementType.choices",
        "NotificationLevelEnum": "apps.notifications.models.NotificationLevel.choices",
        "NotificationCategoryEnum": "apps.notifications.models.NotificationCategory.choices",
        "CleaningTaskStatusEnum": "apps.housekeeping.constants.CleaningTaskStatus.choices",
        "CleaningTaskTypeEnum": "apps.housekeeping.constants.CleaningTaskType.choices",
        "MaintenanceStatusEnum": "apps.housekeeping.constants.MaintenanceStatus.choices",
        "MaintenanceCategoryEnum": "apps.housekeeping.constants.MaintenanceCategory.choices",
        "MaintenancePriorityEnum": "apps.housekeeping.constants.MaintenancePriority.choices",
        "ShiftStatusEnum": "apps.finances.constants.ShiftStatus.choices",
        "ShiftTypeEnum": "apps.finances.constants.ShiftType.choices",
        "CashCountKindEnum": "apps.finances.constants.CashCountKind.choices",
        "CashDirectionEnum": "apps.finances.constants.CashDirection.choices",
        "CashMovementReasonEnum": "apps.finances.constants.CashMovementReason.choices",
        "ExpenseStatusEnum": "apps.finances.constants.ExpenseStatus.choices",
        "ExpenseCategoryEnum": "apps.finances.constants.ExpenseCategory.choices",
    },
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Channels (WebSockets)
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

# En equipos de desarrollo sin Redis se puede usar la capa en memoria; no
# sirve para produccion porque no comparte eventos entre procesos.
if env.bool("USE_IN_MEMORY_CHANNEL_LAYER", default=False):
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
                "capacity": 2000,
                "expiry": 30,
            },
        },
    }

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="django-db")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_ENABLE_UTC = True
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# Si el broker no contesta rápido, quien publica la tarea no se queda colgado:
# la impresión de tickets tiene respaldo sincrono.
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 2, "socket_timeout": 2}
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ---------------------------------------------------------------------------
# Reglas de negocio configurables
# ---------------------------------------------------------------------------
EXPIRATION_WARNING_MINUTES = env("EXPIRATION_WARNING_MINUTES")
EXPENSE_APPROVAL_THRESHOLD = env("EXPENSE_APPROVAL_THRESHOLD")

BUSINESS_NAME = env("BUSINESS_NAME", default="Motel")
BUSINESS_ADDRESS = env("BUSINESS_ADDRESS", default="")
TICKET_FOOTER = env("TICKET_FOOTER", default="Gracias por su visita")

# ---------------------------------------------------------------------------
# Impresión termica (ESC/POS)
# backend: dummy | network | usb | file
# ---------------------------------------------------------------------------
PRINTER_BACKEND = env("PRINTER_BACKEND", default="dummy")
PRINTER_HOST = env("PRINTER_HOST", default="192.168.1.100")
PRINTER_PORT = env.int("PRINTER_PORT", default=9100)
PRINTER_USB_VENDOR_ID = env("PRINTER_USB_VENDOR_ID", default="0x04b8")
PRINTER_USB_PRODUCT_ID = env("PRINTER_USB_PRODUCT_ID", default="0x0202")
PRINTER_FILE_PATH = env("PRINTER_FILE_PATH", default=str(BASE_DIR / "tickets.txt"))
PRINT_TICKET_ON_FOLIO_CLOSE = env.bool("PRINT_TICKET_ON_FOLIO_CLOSE", default=True)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {process:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {"level": "WARNING", "handlers": ["console"], "propagate": False},
        "apps": {"level": "DEBUG" if DEBUG else "INFO", "handlers": ["console"], "propagate": False},
        "common": {"level": "DEBUG" if DEBUG else "INFO", "handlers": ["console"], "propagate": False},
    },
}
