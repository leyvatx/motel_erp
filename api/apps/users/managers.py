"""Managers del modelo de usuario."""

from __future__ import annotations

from django.contrib.auth.models import BaseUserManager

from common.managers import ScopedQuerySet, SoftDeleteQuerySet


class UserManager(BaseUserManager.from_queryset(ScopedQuerySet)):
    """Manager por defecto: empleados vigentes del motel en curso.

    Quien administra la plataforma no tiene motel asignado, así que ve a todos;
    dentro de un motel nadie ve la plantilla de otro.
    """

    use_in_migrations = True

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().for_current_motel().filter(is_active=True)

    def get_by_natural_key(self, username: str):
        """Resuelve la clave dentro del motel en curso.

        La misma clave vive en varios moteles, así que sin contexto la
        búsqueda puede traer más de uno. Ahí se niega el acceso en vez de
        reventar con ``MultipleObjectsReturned``: el login de la API resuelve
        el motel antes de llegar aquí y explica qué falta, y cualquier otra
        puerta -- el admin de Django -- no tiene con qué adivinar.
        """
        campo = self.model.USERNAME_FIELD
        coincidencias = list(self.filter(**{campo: username})[:2])
        if len(coincidencias) != 1:
            raise self.model.DoesNotExist(
                f"No hay un usuario único con {campo}={username!r} en este contexto."
            )
        return coincidencias[0]

    def _create_user(self, username: str, password: str | None, **extra_fields):
        if not username:
            raise ValueError("El nombre de usuario es obligatorio.")
        email = self.normalize_email(extra_fields.pop("email", "") or "")
        user = self.model(username=username.strip().lower(), email=email, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, username: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username: str, password: str | None = None, **extra_fields):
        from apps.users.constants import Role

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.SUPERADMIN)
        extra_fields.setdefault("full_name", username)

        if extra_fields["is_staff"] is not True:
            raise ValueError("El superusuario requiere is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("El superusuario requiere is_superuser=True.")
        return self._create_user(username, password, **extra_fields)


class AllUsersManager(BaseUserManager.from_queryset(SoftDeleteQuerySet)):
    """Incluye usuarios dados de baja. Necesario para auditoría histórica."""
