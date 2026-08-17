"""Carga un motel de ejemplo para probar el sistema de punta a punta.

    python manage.py seed_demo

Es idempotente: se puede correr varias veces sin duplicar catalogos.
"""

from __future__ import annotations

import os
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.finances.services import open_shift
from apps.inventory.constants import ProductKind, WarehouseType
from apps.inventory.models import Product, ProductCategory, Warehouse
from apps.inventory.services import register_entry
from apps.rooms.constants import PriceMode, TariffRuleType
from apps.rooms.models import Room, RoomType, TariffBlock
from apps.rooms.services import rent_room
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel

DEMO_PASSWORD = os.environ.get("SEED_DEMO_PASSWORD", "Demo.1234")

USERS = [
    ("admin", "Admin General", Role.SUPERADMIN, True),
    ("gerente", "Ines Gerente", Role.MANAGER, False),
    ("recepcion", "Ana Recepción", Role.RECEPTION, False),
    ("limpieza", "Eva Limpieza", Role.HOUSEKEEPING, False),
]

ROOM_TYPES = [
    ("Sencilla", "SEN", 2, "80.00", 1),
    ("Jacuzzi", "JAC", 2, "120.00", 2),
    ("Suite", "SUI", 4, "150.00", 3),
]

TARIFFS = {
    "SEN": [("4 horas", 240, "350.00", "100.00"), ("8 horas", 480, "550.00", "120.00"),
            ("Pernocta", 720, "650.00", "150.00")],
    "JAC": [("4 horas", 240, "550.00", "150.00"), ("8 horas", 480, "820.00", "180.00"),
            ("Pernocta", 720, "980.00", "200.00")],
    "SUI": [("4 horas", 240, "780.00", "200.00"), ("Pernocta", 720, "1400.00", "250.00")],
}

PRODUCTS = [
    ("CERV-355", "Cerveza clara 355 ml", ProductKind.BEVERAGE, "45.00", "0.1600", 48),
    ("REF-600", "Refresco 600 ml", ProductKind.BEVERAGE, "35.00", "0.1600", 60),
    ("AGU-1000", "Agua natural 1 L", ProductKind.BEVERAGE, "25.00", "0.0000", 72),
    ("BOT-CAC", "Cacahuates japoneses", ProductKind.FOOD, "30.00", "0.1600", 40),
    ("PIZ-IND", "Pizza individual", ProductKind.FOOD, "150.00", "0.1600", 15),
    ("SEX-001", "Kit de lenceria", ProductKind.SHOP, "320.00", "0.1600", 10),
    ("LIM-CLO", "Cloro 1 L", ProductKind.CLEANING, "0.00", "0.0000", 24),
    ("BLA-TOA", "Juego de toallas", ProductKind.LINEN, "0.00", "0.0000", 60),
]


class Command(BaseCommand):
    help = "Crea usuarios, habitaciones, tarifas, inventario y algunas rentas de ejemplo."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--rooms", type=int, default=18, help="Cantidad de habitaciones a crear."
        )
        parser.add_argument(
            "--motel", default="", help="Nombre del motel de ejemplo. Vacío usa el primero."
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        motel = self._crear_motel(options["motel"])

        with use_motel(motel):
            usuarios = self._crear_usuarios(motel)
            tipos = self._crear_tipos_y_tarifas()
            self._crear_habitaciones(tipos, options["rooms"])
            self._crear_inventario(usuarios["gerente"])
            self._rentar_algunas(usuarios["recepcion"])

        self.stdout.write(self.style.SUCCESS(f"\nMotel de ejemplo listo: {motel.name}."))
        self.stdout.write(f"Usuarios: {', '.join(u[0] for u in USERS)}")
        self.stdout.write(f"Contrasena: {DEMO_PASSWORD}")

    def _crear_motel(self, nombre: str) -> Motel:
        if nombre:
            motel, creado = Motel.all_objects.get_or_create(name=nombre)
        else:
            motel = Motel.objects.order_by("pk").first()
            creado = motel is None
            if motel is None:
                motel = Motel.defaults()
                motel.save()

        if creado:
            self.stdout.write(f"  motel {motel.name}")
        return motel

    def _crear_usuarios(self, motel: Motel) -> dict[str, User]:
        creados: dict[str, User] = {}
        for username, nombre, rol, es_super in USERS:
            user = User.all_objects.filter(username=username, motel=motel).first()
            if user is None:
                factory = User.objects.create_superuser if es_super else User.objects.create_user
                user = factory(
                    username=username,
                    password=DEMO_PASSWORD,
                    full_name=nombre,
                    role=rol,
                    motel=motel,
                )
                self.stdout.write(f"  usuario {username} ({rol})")
            creados[username] = user
        return creados

    def _crear_tipos_y_tarifas(self) -> dict[str, RoomType]:
        tipos: dict[str, RoomType] = {}
        for nombre, clave, ocupantes, extra, orden in ROOM_TYPES:
            tipo, _ = RoomType.objects.get_or_create(
                code=clave,
                defaults={
                    "name": nombre,
                    "max_occupants": ocupantes,
                    "extra_person_price": Decimal(extra),
                    "sort_order": orden,
                },
            )
            tipos[clave] = tipo

            for indice, (bloque, minutos, precio, recargo) in enumerate(TARIFFS[clave]):
                TariffBlock.objects.get_or_create(
                    room_type=tipo,
                    name=bloque,
                    defaults={
                        "duration_minutes": minutos,
                        "base_price": Decimal(precio),
                        "overstay_hour_price": Decimal(recargo),
                        "grace_minutes": 15,
                        "is_overnight": bloque == "Pernocta",
                        "is_default": indice == 0,
                        "sort_order": indice,
                    },
                )

        for tipo in tipos.values():
            for bloque in tipo.tariff_blocks.all():
                bloque.rules.get_or_create(
                    name="Fin de semana",
                    defaults={
                        "rule_type": TariffRuleType.WEEKDAY,
                        "weekdays": [4, 5, 6],
                        "price_mode": PriceMode.MULTIPLIER,
                        "value": Decimal("1.20"),
                        "priority": 100,
                    },
                )
        return tipos

    def _crear_habitaciones(self, tipos: dict[str, RoomType], cantidad: int) -> None:
        claves = list(tipos.keys())
        for indice in range(cantidad):
            piso = indice // 10 + 1
            numero = f"{piso}{indice % 10 + 1:02d}"
            clave = claves[indice % len(claves)]
            Room.objects.get_or_create(
                number=numero,
                defaults={
                    "room_type": tipos[clave],
                    "floor": piso,
                    "zone": f"Edificio {'A' if piso == 1 else 'B'}",
                    "has_garage": True,
                },
            )

    def _crear_inventario(self, actor: User) -> None:
        almacen, _ = Warehouse.objects.get_or_create(
            code="GEN",
            defaults={"name": "Almacén general", "warehouse_type": WarehouseType.GENERAL},
        )
        bar, _ = Warehouse.objects.get_or_create(
            code="BAR",
            defaults={
                "name": "Bar y room service",
                "warehouse_type": WarehouseType.BAR,
                "is_default_for_sales": True,
            },
        )

        for sku, nombre, familia, precio, impuesto, existencia in PRODUCTS:
            categoria, _ = ProductCategory.objects.get_or_create(
                name=familia.label, kind=familia
            )
            producto, creado = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": nombre,
                    "category": categoria,
                    "sale_price": Decimal(precio),
                    "tax_rate": Decimal(impuesto),
                    "is_sellable": Decimal(precio) > 0,
                    "default_min_stock": Decimal("12"),
                },
            )
            if not creado:
                continue

            destino = bar if producto.is_sellable else almacen
            register_entry(
                product=producto,
                warehouse=destino,
                quantity=Decimal(existencia),
                unit_cost=(Decimal(precio) / Decimal("2.5")) if Decimal(precio) else Decimal("15"),
                actor=actor,
                reason="Inventario inicial de ejemplo",
            )
            stock = producto.stocks.get(warehouse=destino)
            stock.min_stock = Decimal("12")
            stock.save(update_fields=["min_stock", "updated_at"])

    def _rentar_algunas(self, actor: User) -> None:
        """Deja algunas habitaciones ocupadas para ver el grid con vida."""
        if not open_shift.__module__:
            return

        from apps.finances.services import get_open_shift

        if get_open_shift(actor) is None:
            open_shift(cashier=actor, opening_balance=Decimal("1500.00"), breakdown={"500": 3})

        from apps.rooms.constants import StayStatus

        libres = list(
            Room.objects.filter(status="AVAILABLE").exclude(
                stays__status=StayStatus.ACTIVE
            )[:4]
        )
        placas = ["ABC123", "XKT908", "MNP447", "QWE555"]

        for indice, room in enumerate(libres):
            bloque = room.room_type.tariff_blocks.filter(is_default=True).first()
            if bloque is None:
                continue
            rent_room(
                room_id=room.pk,
                tariff_block_id=bloque.pk,
                actor=actor,
                occupants=2,
                vehicle_plate=placas[indice % len(placas)],
                vehicle_description="Sedan gris",
            )
            self.stdout.write(f"  renta en habitacion {room.number}")
