"""Renombra o retira una sucursal, para dejar el sistema listo para su dueño real.

Sirve para el caso de estrenar: la instalación arrancó con una sucursal sembrada
desde el entorno -- "Motel Demo", "Negocio Demo", el nombre que tuviera la
variable ese día -- y hay que dejarle el espacio limpio a quien lo va a usar.

No borra nada físicamente. Retirar una sucursal es la misma baja lógica que hace
la pantalla de plataforma: la suspende y desactiva a su gente, conservando
folios, turnos y bitácora. En este sistema no se borra historial contable, y un
comando de mantenimiento no es la excepción.

Tampoco vacía una sucursal por dentro. Las habitaciones están protegidas por las
rentas y los folios que cuelgan de ellas, así que un borrado en cascada o
fallaría a la mitad o dejaría la contabilidad rota. El camino sano es retirar la
sucursal sembrada y crear la de verdad desde Plataforma -> Sucursales: nace
vacía, y su dueño entra directo al asistente de alta.

Sin ``--si`` no toca nada: enseña qué haría y qué se lleva por delante.

Ejemplos::

    python manage.py reset_tenant --slug motel-demo
    python manage.py reset_tenant --slug motel-demo --renombrar "Cabañas del Lago" --si
    python manage.py reset_tenant --slug motel-demo --retirar --si
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.settings.models import Motel
from apps.settings.services import deactivate_motel
from apps.users.models import User


class Command(BaseCommand):
    help = "Renombra o retira una sucursal. Sin --si solo muestra lo que haría."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--slug", required=True, help="Identificador de la sucursal.")
        parser.add_argument("--renombrar", default="", help="Nombre comercial nuevo.")
        parser.add_argument(
            "--retirar",
            action="store_true",
            help="Suspende la sucursal y desactiva a su personal.",
        )
        parser.add_argument("--si", action="store_true", help="Aplica los cambios de verdad.")

    def handle(self, *args, **options) -> None:
        slug = options["slug"].strip()
        renombrar = options["renombrar"].strip()
        retirar = options["retirar"]
        aplicar = options["si"]

        if not renombrar and not retirar:
            raise CommandError("Elige --renombrar <nombre> o --retirar.")
        if renombrar and retirar:
            raise CommandError("--renombrar y --retirar no van juntos: decide una.")

        motel = Motel.all_objects.filter(slug=slug).first()
        if motel is None:
            existentes = ", ".join(Motel.all_objects.values_list("slug", flat=True)) or "ninguna"
            raise CommandError(f"No hay sucursal con slug «{slug}». Existen: {existentes}.")

        self._resumen(motel)

        if retirar:
            activas = Motel.objects.exclude(pk=motel.pk).count()
            if activas == 0:
                self.stdout.write(
                    self.style.WARNING(
                        "\n  AVISO: es la única sucursal activa. Al retirarla, solo la cuenta de\n"
                        "  plataforma podrá entrar, y tendrá que dar de alta la nueva desde\n"
                        "  Plataforma -> Sucursales."
                    )
                )

        if not aplicar:
            accion = f'renombrarla a «{renombrar}»' if renombrar else "retirarla"
            self.stdout.write(
                self.style.WARNING(f"\nEnsayo. Vuelve a correrlo con --si para {accion}.")
            )
            return

        if renombrar:
            anterior = motel.name
            motel.name = renombrar
            motel.save(update_fields=["name", "updated_at"])
            self.stdout.write(
                self.style.SUCCESS(f"\nRenombrada: «{anterior}» -> «{motel.name}».")
            )
            return

        deactivate_motel(motel=motel, reason="Retirada con reset_tenant")
        self.stdout.write(self.style.SUCCESS(f"\nSucursal «{motel.name}» retirada."))
        self.stdout.write(
            "Siguiente paso: entra con la cuenta de plataforma y da de alta la sucursal\n"
            "real desde Plataforma -> Sucursales. Nace vacía, así que su dueño va a\n"
            "encontrarse el asistente de alta en el primer acceso."
        )

    def _resumen(self, motel: Motel) -> None:
        """Qué hay dentro. Nadie debería decidir esto a ciegas.

        El filtro por sucursal va explícito: ``all_objects`` no acota por motel
        -- es el manager base que Django usa para resolver llaves foráneas, y
        filtrarlo ahí rompería las relaciones -- así que contar con él sin más
        daría los totales de toda la plataforma.
        """
        from apps.rooms.models import Room, RoomType, Stay, TariffBlock

        filas = [
            ("Personal", User.all_objects.filter(motel=motel).count()),
            ("Tipos de habitación", RoomType.all_objects.filter(motel=motel).count()),
            ("Tarifas", TariffBlock.all_objects.filter(motel=motel).count()),
            ("Habitaciones", Room.all_objects.filter(motel=motel).count()),
            ("Rentas registradas", Stay.all_objects.filter(motel=motel).count()),
        ]

        estado = "activa" if motel.is_active else "ya retirada"
        self.stdout.write(f"Sucursal: «{motel.name}» ({motel.slug}), {estado}.")
        for etiqueta, total in filas:
            self.stdout.write(f"  {etiqueta}: {total}")
