"""Crea la cuenta con la que un cliente estrena su sistema.

``createsuperuser`` no sirve para esto por dos razones. Es interactivo, y contra
una base remota eso se atora. Y sobre todo crea un superusuario *de plataforma*
-- sin sucursal -- que ve el alta de sucursales y nada más: no puede rentar, no
puede cobrar y el asistente de alta no le aparece nunca. Quien recibe el sistema
necesita lo contrario: mandar sobre su sucursal.

Por eso este comando crea un super administrador **con sucursal**. Si todavía no
hay ninguna, la crea junto con él en la misma transacción, con el nombre
centinela que hace que el asistente pida el nombre real en el primer acceso.

La contraseña se puede pasar por argumento, pero se lee mejor de
``CLIENT_ADMIN_PASSWORD``: lo que va en la línea de comandos queda en el
historial del shell y a la vista de cualquiera que liste procesos en esa
máquina.

Ejemplos::

    CLIENT_ADMIN_PASSWORD='...' python manage.py create_client_admin \\
        --email admin@sucliente.com

    python manage.py create_client_admin --email admin@sucliente.com \\
        --username gerencia --nombre "Ana Torres" --password '...'
"""

from __future__ import annotations

import os
import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.settings.models import Motel
from apps.settings.services import create_motel
from apps.users.constants import Role
from apps.users.models import User

VARIABLE_CLAVE = "CLIENT_ADMIN_PASSWORD"

# El mismo que valida el modelo. Se repite aquí para poder explicar el problema
# antes de intentar guardar, en vez de soltar un error de validación crudo.
FORMATO_USUARIO = re.compile(r"^[a-z0-9._-]{3,40}$")

# Tiene que coincidir con BUSINESS_NAME de core/settings.py: es lo que el
# asistente de alta lee como "este negocio todavía no se ha presentado".
NOMBRE_SEMBRADO = "Mi negocio"


class Command(BaseCommand):
    help = "Crea el super administrador de una sucursal, listo para el asistente de alta."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--email", required=True, help="Correo de la persona.")
        parser.add_argument(
            "--username",
            default="",
            help="Clave de acceso. Si se omite, sale de la parte izquierda del correo.",
        )
        parser.add_argument("--password", default="", help=f"Mejor usa {VARIABLE_CLAVE}.")
        parser.add_argument("--nombre", default="", help="Nombre completo para la interfaz.")
        parser.add_argument(
            "--sucursal",
            default="",
            help="Slug de la sucursal. Si se omite, usa la única activa o crea una.",
        )
        parser.add_argument(
            "--exigir-cambio",
            action="store_true",
            help="Obliga a cambiar la contraseña en el primer acceso.",
        )

    def handle(self, *args, **options) -> None:
        email = options["email"].strip().lower()
        username = (options["username"].strip() or self._usuario_desde(email)).lower()
        nombre = options["nombre"].strip() or email.split("@")[0].replace(".", " ").title()
        password = options["password"] or os.environ.get(VARIABLE_CLAVE, "")

        if not password:
            raise CommandError(
                f"Falta la contraseña. Pásala en {VARIABLE_CLAVE} o con --password."
            )
        if not FORMATO_USUARIO.match(username):
            raise CommandError(
                f"«{username}» no sirve como clave de acceso: solo minúsculas, números, "
                "punto, guion y guion bajo, de 3 a 40 caracteres. Pásala con --username."
            )
        self._validar_clave(password, username, email, nombre)

        motel = self._resolver_sucursal(options["sucursal"].strip())

        if motel is not None and User.all_objects.filter(motel=motel, username=username).exists():
            raise CommandError(
                f"Ya existe «{username}» en «{motel.name}». Elige otra clave con --username, "
                "o cambia la contraseña desde la pantalla de Usuarios."
            )

        with transaction.atomic():
            if motel is None:
                motel = create_motel(
                    owner_username=username,
                    owner_full_name=nombre,
                    owner_password=password,
                    name=NOMBRE_SEMBRADO,
                )
                usuario = User.all_objects.get(motel=motel, username=username)
                creada = True
            else:
                usuario = User.objects.create_user(
                    username=username,
                    password=password,
                    full_name=nombre,
                    role=Role.SUPERADMIN,
                    motel=motel,
                )
                creada = False

            if email or options["exigir_cambio"]:
                usuario.email = email
                usuario.must_change_password = options["exigir_cambio"]
                usuario.save(update_fields=["email", "must_change_password", "updated_at"])

        self._reporte(usuario, motel, creada=creada)

    def _usuario_desde(self, email: str) -> str:
        """La clave de acceso sale del correo, limpiando lo que el modelo no admite."""
        local = email.split("@")[0]
        return re.sub(r"[^a-z0-9._-]", "", local.lower())

    def _validar_clave(self, password: str, *atributos: str) -> None:
        """Las mismas reglas que la interfaz.

        Vale la pena aquí y no solo al guardar: esta contraseña se le entrega a
        alguien más, y enterarse de que es débil después de mandarla por correo
        no sirve de nada.
        """
        provisional = User(username=atributos[0], email=atributos[1], full_name=atributos[2])
        try:
            validate_password(password, user=provisional)
        except ValidationError as exc:
            detalle = "\n  ".join(exc.messages)
            raise CommandError(f"Esa contraseña no pasa las reglas del sistema:\n  {detalle}")

    def _resolver_sucursal(self, slug: str) -> Motel | None:
        """La sucursal donde va a mandar. ``None`` significa que hay que crearla."""
        if slug:
            motel = Motel.all_objects.filter(slug=slug).first()
            if motel is None:
                existentes = (
                    ", ".join(Motel.objects.values_list("slug", flat=True)) or "ninguna activa"
                )
                raise CommandError(f"No hay sucursal «{slug}». Existen: {existentes}.")
            if not motel.is_active:
                raise CommandError(
                    f"La sucursal «{motel.name}» está retirada. Reactívala antes de darle gente."
                )
            return motel

        activas = list(Motel.objects.all()[:2])
        if len(activas) > 1:
            slugs = ", ".join(m.slug for m in activas)
            raise CommandError(f"Hay más de una sucursal activa. Elige con --sucursal: {slugs}…")
        return activas[0] if activas else None

    def _reporte(self, usuario: User, motel: Motel, *, creada: bool) -> None:
        self.stdout.write(self.style.SUCCESS("\nCuenta lista."))
        self.stdout.write(f"  Usuario:   {usuario.username}")
        self.stdout.write(f"  Correo:    {usuario.email or '—'}")
        self.stdout.write(f"  Rol:       {usuario.get_role_display()}")
        self.stdout.write(f"  Sucursal:  {motel.name} ({motel.slug})")

        if creada:
            self.stdout.write(
                "\nLa sucursal se creó junto con la cuenta y todavía no tiene nombre propio,\n"
                "así que en el primer acceso va a aparecer el asistente de alta pidiendo\n"
                "nombre, logotipo, tipo de habitación, tarifa y habitaciones."
            )
        elif motel.name == NOMBRE_SEMBRADO:
            self.stdout.write("\nLa sucursal sigue sin nombre propio: verá el asistente de alta.")
        else:
            self.stdout.write(
                f"\nLa sucursal ya se llama «{motel.name}», así que el asistente no le va a\n"
                "pedir el nombre; sí el resto de lo que falte."
            )

        self.stdout.write(
            self.style.WARNING(
                "\nLa contraseña no se imprime a propósito. Compártela por un canal aparte."
            )
        )
