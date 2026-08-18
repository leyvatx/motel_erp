"""Modelo de usuario / empleado del motel.

Se usa ``username`` (clave de empleado) en lugar de email porque el personal
operativo -- limpieza, recepción -- no siempre tiene correo corporativo.
La baja de un empleado es lógica: ``is_active=False`` lo deshabilita para
iniciar sesión pero conserva toda su trazabilidad histórica.

La clave es única *dentro de su motel*, no en toda la plataforma: cincuenta
moteles quieren los mismos nombres obvios -- ``recepcion``, ``caja1`` -- y
obligarlos a inventar variantes termina en que alguien entra a la cuenta
equivocada. Quien no pertenece a ningún motel (plataforma y corporativo)
comparte un solo espacio de nombres aparte.
"""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

from apps.users.constants import CASHIER_ROLES, HOUSEKEEPING_ROLES, MANAGEMENT_ROLES, Role
from apps.users.managers import AllUsersManager, UserManager
from common.models import SoftDeleteModel, TimeStampedModel

username_validator = RegexValidator(
    regex=r"^[a-z0-9._-]{3,40}$",
    message="Solo minúsculas, números, punto, guion y guion bajo (3 a 40 caracteres).",
)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel, SoftDeleteModel):
    username = models.CharField(
        "Usuario",
        max_length=40,
        db_index=True,
        validators=[username_validator],
        help_text="Clave de acceso del empleado.",
    )
    motel = models.ForeignKey(
        "settings.Motel",
        verbose_name="Motel",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        help_text="Vacío solo para quien administra la plataforma completa.",
    )
    full_name = models.CharField("Nombre completo", max_length=150)
    email = models.EmailField("Correo", blank=True)
    phone = models.CharField("Teléfono", max_length=20, blank=True)
    role = models.CharField(
        "Rol", max_length=20, choices=Role.choices, default=Role.RECEPTION, db_index=True
    )
    employee_number = models.CharField(
        "Número de empleado", max_length=20, blank=True, db_index=True
    )
    hired_at = models.DateField("Fecha de ingreso", null=True, blank=True)
    must_change_password = models.BooleanField("Debe cambiar contraseña", default=False)
    last_login_ip = models.GenericIPAddressField("Última IP", null=True, blank=True)

    is_staff = models.BooleanField(
        "Acceso al admin", default=False, help_text="Permite entrar al panel de Django."
    )

    objects = UserManager()
    all_objects = AllUsersManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["full_name"]
        base_manager_name = "all_objects"
        constraints = [
            models.UniqueConstraint(
                fields=["motel", "username"], name="uniq_user_username_motel"
            ),
            models.UniqueConstraint(
                fields=["username"],
                condition=models.Q(motel__isnull=True),
                name="uniq_user_username_sin_motel",
            ),
        ]
        indexes = [
            models.Index(fields=["role", "is_active"], name="user_role_active_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.username})"

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else self.username

    @property
    def is_platform_admin(self) -> bool:
        """Administra la plataforma completa, no un motel en particular."""
        return self.is_superuser and self.motel_id is None

    @property
    def is_corporate_user(self) -> bool:
        if self.motel_id is not None or self.is_platform_admin:
            return False
        return self.corporate_accesses.filter(is_active=True).exists()

    @property
    def is_superadmin(self) -> bool:
        return self.role == Role.SUPERADMIN or self.is_superuser

    @property
    def is_management(self) -> bool:
        role = getattr(self, "active_access_role", self.role)
        return self.is_superuser or role in MANAGEMENT_ROLES

    @property
    def can_operate_cash(self) -> bool:
        return self.is_superuser or self.role in CASHIER_ROLES

    @property
    def can_operate_housekeeping(self) -> bool:
        return self.is_superuser or self.role in HOUSEKEEPING_ROLES


class UserPresence(TimeStampedModel):
    """Quién está conectado en este momento.

    Se lleva aparte del modelo de usuario a propósito: la presencia cambia
    cada vez que alguien abre o cierra una pestaña, y ensuciaría la bitácora
    de auditoría si viviera en ``User``.

    ``connections`` cuenta sockets abiertos, no personas: un mismo empleado
    mantiene dos (el grid y las notificaciones) y puede tener otra pestaña.
    """

    STALE_MINUTES = 5

    user = models.OneToOneField(
        User,
        verbose_name="Usuario",
        on_delete=models.CASCADE,
        related_name="presence",
    )
    connections = models.PositiveSmallIntegerField("Conexiones abiertas", default=0)
    last_seen_at = models.DateTimeField("Visto por última vez", null=True, blank=True)
    last_section = models.CharField("Última sección", max_length=40, blank=True)

    class Meta:
        verbose_name = "Presencia de usuario"
        verbose_name_plural = "Presencia de usuarios"
        ordering = ["-last_seen_at"]
        indexes = [
            models.Index(fields=["-last_seen_at"], name="presence_last_seen_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user.username}: {'en línea' if self.is_online else 'desconectado'}"

    @property
    def is_online(self) -> bool:
        from django.utils import timezone

        if self.connections <= 0 or self.last_seen_at is None:
            return False
        limite = timezone.now() - timezone.timedelta(minutes=self.STALE_MINUTES)
        return self.last_seen_at >= limite


class UserActivity(TimeStampedModel):
    """Bitácora ligera de sesiones (login / logout) por usuario.

    Es independiente del AuditLog de la Fase 6: aquí solo interesa el acceso.
    """

    class Action(models.TextChoices):
        LOGIN = "LOGIN", "Inicio de sesión"
        LOGOUT = "LOGOUT", "Cierre de sesión"
        LOGIN_FAILED = "LOGIN_FAILED", "Intento fallido"
        PASSWORD_CHANGED = "PASSWORD_CHANGED", "Cambio de contraseña"

    user = models.ForeignKey(
        User,
        verbose_name="Usuario",
        on_delete=models.PROTECT,
        related_name="activities",
        null=True,
        blank=True,
    )
    username_attempted = models.CharField("Usuario intentado", max_length=40, blank=True)
    action = models.CharField("Acción", max_length=20, choices=Action.choices)
    ip_address = models.GenericIPAddressField("IP", null=True, blank=True)
    user_agent = models.CharField("Agente", max_length=255, blank=True)

    class Meta:
        verbose_name = "Actividad de usuario"
        verbose_name_plural = "Actividades de usuario"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="useract_user_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_action_display()} - {self.user or self.username_attempted}"
