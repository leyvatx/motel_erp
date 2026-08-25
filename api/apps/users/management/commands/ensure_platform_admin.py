"""Crea la cuenta de plataforma desde variables de entorno, si no existe.

``createsuperuser`` es interactivo y exige una terminal. En Render el plan
gratuito no da acceso a Shell, así que no hay dónde teclearlo y la instalación
se queda sin la única cuenta capaz de dar de alta moteles.

Es idempotente: si la cuenta ya existe no la toca ni le cambia la contraseña.
Sin ``PLATFORM_ADMIN_USERNAME`` y ``PLATFORM_ADMIN_PASSWORD`` no hace nada, de
modo que arrancar sin ellas -- el caso normal en desarrollo -- es inofensivo.

La cuenta nace sin motel: ``is_platform_admin`` exige ``motel_id`` nulo, que es
lo que distingue a quien administra la plataforma de un superusuario que
pertenece a una propiedad.
"""

from __future__ import annotations

import os

from django.core.management.base import BaseCommand

from apps.users.models import User


class Command(BaseCommand):
    help = "Crea la cuenta de plataforma desde el entorno si todavía no existe."

    def handle(self, *args, **options) -> None:
        username = (os.environ.get("PLATFORM_ADMIN_USERNAME") or "").strip().lower()
        password = os.environ.get("PLATFORM_ADMIN_PASSWORD") or ""

        if not username or not password:
            self.stdout.write("Sin PLATFORM_ADMIN_USERNAME/PASSWORD: no se crea nada.")
            return

        if User.all_objects.filter(username=username, motel__isnull=True).exists():
            self.stdout.write(f"La cuenta de plataforma «{username}» ya existe.")
            return

        User.objects.create_superuser(
            username=username,
            password=password,
            full_name=os.environ.get("PLATFORM_ADMIN_NAME") or "Administrador de plataforma",
            motel=None,
        )
        self.stdout.write(self.style.SUCCESS(f"Cuenta de plataforma «{username}» creada."))
