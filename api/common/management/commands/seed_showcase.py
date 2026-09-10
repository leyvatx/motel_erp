"""Siembra una sucursal grande, con historia, para enseñar el sistema.

    python manage.py seed_showcase

``seed_demo`` alcanza para probar que algo funciona: cuatro usuarios, dieciocho
cuartos y un par de rentas. Para *enseñar* el sistema no alcanza. Las pantallas
que más se lucen -- reportes, corte de caja, ocupación por tipo, productividad
del ama de llaves -- están vacías hasta que hay semanas de operación detrás, y
una demo con tres renglones se ve peor que no enseñar nada.

Esto crea la sucursal completa: plantilla de veintitantas personas, sesenta y
cuatro habitaciones en seis tipos, catálogo de inventario con proveedores y
compras, y varias semanas de turnos cerrados con sus rentas, consumos, cobros,
gastos, limpiezas y reportes de mantenimiento. Al final deja el presente vivo:
cuartos ocupados con su reloj corriendo, otros en limpieza, uno fuera de
servicio y reservaciones para los próximos días.

La historia se escribe con el reloj movido: cada jornada simulada corre con
``timezone.now`` fijado en su día, de modo que folios, consecutivos, días de
operación y duraciones quedan como si de verdad hubieran pasado. Es la única
manera de que los reportes por fecha tengan algo que contar.

Es idempotente por sucursal: se identifica por su ``slug``. Volver a correrlo
sobre una sucursal ya sembrada no duplica nada -- avisa y se sale --; para
rehacerla desde cero está ``--rehacer``.
"""

from __future__ import annotations

import random
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Iterator

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test.utils import override_settings
from django.utils import timezone

from apps.finances.constants import (
    CashDirection,
    CashMovementReason,
    ExpenseCategory,
    ShiftType,
)
from apps.finances.services import (
    close_shift,
    open_shift,
    register_cash_movement,
    register_expense,
    review_expense,
    verify_shift,
)
from apps.housekeeping.constants import (
    CleaningTaskStatus,
    CleaningTaskType,
    MaintenanceCategory,
    MaintenancePriority,
    MaintenanceStatus,
)
from apps.housekeeping.models import CleaningTask
from apps.housekeeping.services import (
    assign_cleaning_task,
    create_cleaning_task,
    finish_cleaning_task,
    report_maintenance,
    start_cleaning_task,
    update_maintenance_status,
    verify_cleaning_task,
)
from apps.inventory.constants import ProductKind, PurchaseStatus, UnitOfMeasure, WarehouseType
from apps.inventory.models import (
    Product,
    ProductCategory,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    Warehouse,
)
from apps.inventory.services import receive_purchase, register_entry, register_waste
from apps.rooms.constants import PriceMode, RoomStatus, TariffRuleType
from apps.rooms.models import Holiday, Room, RoomType, TariffBlock
from apps.rooms.services import (
    checkout_stay,
    create_reservation,
    extend_stay,
    rent_room,
    set_room_out_of_service,
)
from apps.sales.constants import OrderType, PaymentMethod
from apps.sales.services import counter_sale, create_order
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User
from common.tenancy import use_motel
from common.utils import money

# ---------------------------------------------------------------------------
# Catálogos de la sucursal de ejemplo
# ---------------------------------------------------------------------------

SLUG = "villa-esmeralda"
NOMBRE = "Motel Villa Esmeralda"

# La plantilla completa, con sus turnos. La gracia de una demo grande está aquí:
# el tablero de personal, la productividad por camarista y el corte por cajero
# no dicen nada con cuatro usuarios.
PLANTILLA: tuple[tuple[str, str, str, str], ...] = (
    # (usuario, nombre, rol, número de empleado)
    ("laura.mendoza", "Laura Mendoza Ríos", Role.SUPERADMIN, "E-001"),
    ("ricardo.salas", "Ricardo Salas Ibarra", Role.MANAGER, "E-002"),
    ("paola.vega", "Paola Vega Contreras", Role.MANAGER, "E-003"),
    ("ana.torres", "Ana Torres Beltrán", Role.RECEPTION, "E-010"),
    ("jose.ramirez", "José Ramírez Ochoa", Role.RECEPTION, "E-011"),
    ("karla.nunez", "Karla Núñez Sandoval", Role.RECEPTION, "E-012"),
    ("miguel.avila", "Miguel Ávila Zamudio", Role.RECEPTION, "E-013"),
    ("sofia.cardenas", "Sofía Cárdenas Lugo", Role.RECEPTION, "E-014"),
    ("hector.duarte", "Héctor Duarte Peraza", Role.RECEPTION, "E-015"),
    ("brenda.olivas", "Brenda Olivas Quintero", Role.RECEPTION, "E-016"),
    ("eva.castillo", "Eva Castillo Moreno", Role.HOUSEKEEPING, "E-030"),
    ("rosa.jimenez", "Rosa Jiménez Valdez", Role.HOUSEKEEPING, "E-031"),
    ("marta.solis", "Marta Solís Angulo", Role.HOUSEKEEPING, "E-032"),
    ("juana.bernal", "Juana Bernal Espinoza", Role.HOUSEKEEPING, "E-033"),
    ("lupita.andrade", "Guadalupe Andrade Cota", Role.HOUSEKEEPING, "E-034"),
    ("silvia.parra", "Silvia Parra Meza", Role.HOUSEKEEPING, "E-035"),
    ("nora.escobar", "Nora Escobar Tirado", Role.HOUSEKEEPING, "E-036"),
    ("felipa.rendon", "Felipa Rendón Gaxiola", Role.HOUSEKEEPING, "E-037"),
    ("carmen.leyva", "Carmen Leyva Urías", Role.HOUSEKEEPING, "E-038"),
    ("teresa.gil", "Teresa Gil Manjarrez", Role.HOUSEKEEPING, "E-039"),
    ("aurora.pineda", "Aurora Pineda Félix", Role.HOUSEKEEPING, "E-040"),
    ("julia.robles", "Julia Robles Camacho", Role.HOUSEKEEPING, "E-041"),
)

# (nombre, clave, ocupantes, precio persona extra, orden, cuántas de cada 64)
TIPOS: tuple[tuple[str, str, int, str, int, int], ...] = (
    ("Sencilla", "SEN", 2, "80.00", 1, 20),
    ("Doble", "DOB", 4, "90.00", 2, 14),
    ("Jacuzzi", "JAC", 2, "120.00", 3, 12),
    ("Suite", "SUI", 4, "150.00", 4, 8),
    ("Suite Jacuzzi", "SJA", 4, "180.00", 5, 6),
    ("Villa", "VIL", 6, "220.00", 6, 4),
)

# clave -> [(bloque, minutos, precio, recargo por hora)]
TARIFAS: dict[str, tuple[tuple[str, int, str, str], ...]] = {
    "SEN": (("4 horas", 240, "350.00", "100.00"), ("8 horas", 480, "550.00", "120.00"),
            ("Pernocta", 720, "650.00", "150.00")),
    "DOB": (("4 horas", 240, "430.00", "120.00"), ("8 horas", 480, "660.00", "140.00"),
            ("Pernocta", 720, "780.00", "170.00")),
    "JAC": (("4 horas", 240, "550.00", "150.00"), ("8 horas", 480, "820.00", "180.00"),
            ("Pernocta", 720, "980.00", "200.00")),
    "SUI": (("4 horas", 240, "780.00", "200.00"), ("8 horas", 480, "1100.00", "230.00"),
            ("Pernocta", 720, "1400.00", "250.00")),
    "SJA": (("4 horas", 240, "950.00", "240.00"), ("Pernocta", 720, "1650.00", "300.00")),
    "VIL": (("6 horas", 360, "1400.00", "320.00"), ("Pernocta", 720, "2200.00", "400.00")),
}

PROVEEDORES: tuple[tuple[str, str, str, str, int], ...] = (
    ("PRV-01", "Distribuidora Cervecera del Pacífico", "Ismael Quintero", "667 715 3400", 15),
    ("PRV-02", "Abarrotes La Central del Valle", "Norma Zazueta", "667 712 8899", 30),
    ("PRV-03", "Químicos y Limpieza Sinaloa", "Rubén Aispuro", "667 760 1122", 30),
    ("PRV-04", "Blancos y Textiles del Humaya", "Gabriela Inzunza", "667 733 4455", 45),
    ("PRV-05", "Boutique Íntima Mayoreo", "Alan Payán", "667 199 6070", 0),
    ("PRV-06", "Alimentos Preparados El Fogón", "Cecilia Bátiz", "667 754 2233", 7),
)

# (sku, nombre, familia, precio venta, impuesto, existencia inicial, proveedor)
PRODUCTOS: tuple[tuple[str, str, str, str, str, int, str], ...] = (
    ("CERV-355", "Cerveza clara 355 ml", ProductKind.BEVERAGE, "45.00", "0.1600", 240, "PRV-01"),
    ("CERV-OSC", "Cerveza oscura 355 ml", ProductKind.BEVERAGE, "50.00", "0.1600", 120, "PRV-01"),
    ("CERV-CAG", "Caguama 1.2 L", ProductKind.BEVERAGE, "95.00", "0.1600", 60, "PRV-01"),
    ("MICH-PRE", "Michelada preparada", ProductKind.BEVERAGE, "85.00", "0.1600", 40, "PRV-01"),
    ("VINO-TIN", "Media de vino tinto", ProductKind.BEVERAGE, "260.00", "0.1600", 24, "PRV-01"),
    ("TEQ-SHO", "Caballito de tequila", ProductKind.BEVERAGE, "70.00", "0.1600", 50, "PRV-01"),
    ("REF-600", "Refresco 600 ml", ProductKind.BEVERAGE, "35.00", "0.1600", 180, "PRV-02"),
    ("REF-LAT", "Refresco en lata", ProductKind.BEVERAGE, "28.00", "0.1600", 150, "PRV-02"),
    ("AGU-1000", "Agua natural 1 L", ProductKind.BEVERAGE, "25.00", "0.0000", 220, "PRV-02"),
    ("AGU-500", "Agua natural 500 ml", ProductKind.BEVERAGE, "18.00", "0.0000", 200, "PRV-02"),
    ("ENE-473", "Bebida energética 473 ml", ProductKind.BEVERAGE, "60.00", "0.1600", 72, "PRV-02"),
    ("CAF-SOB", "Café soluble en sobre", ProductKind.BEVERAGE, "20.00", "0.1600", 90, "PRV-02"),
    ("BOT-CAC", "Cacahuates japoneses", ProductKind.FOOD, "30.00", "0.1600", 130, "PRV-02"),
    ("BOT-PAP", "Papas fritas", ProductKind.FOOD, "32.00", "0.1600", 140, "PRV-02"),
    ("BOT-CHI", "Chicharrón de harina", ProductKind.FOOD, "28.00", "0.1600", 110, "PRV-02"),
    ("BOT-GAL", "Galletas surtidas", ProductKind.FOOD, "26.00", "0.1600", 100, "PRV-02"),
    ("PIZ-IND", "Pizza individual", ProductKind.FOOD, "150.00", "0.1600", 45, "PRV-06"),
    ("HAM-SEN", "Hamburguesa sencilla", ProductKind.FOOD, "135.00", "0.1600", 40, "PRV-06"),
    ("ALI-BON", "Boneless 250 g", ProductKind.FOOD, "165.00", "0.1600", 35, "PRV-06"),
    ("ALI-PAP", "Papas a la francesa", ProductKind.FOOD, "85.00", "0.1600", 50, "PRV-06"),
    ("ALI-CLU", "Club sándwich", ProductKind.FOOD, "120.00", "0.1600", 30, "PRV-06"),
    ("SEX-KIT", "Kit de lencería", ProductKind.SHOP, "320.00", "0.1600", 30, "PRV-05"),
    ("SEX-PRE", "Preservativos 3 piezas", ProductKind.SHOP, "60.00", "0.1600", 200, "PRV-05"),
    ("SEX-LUB", "Lubricante íntimo", ProductKind.SHOP, "140.00", "0.1600", 60, "PRV-05"),
    ("SEX-MAS", "Aceite para masaje", ProductKind.SHOP, "180.00", "0.1600", 45, "PRV-05"),
    ("SEX-JUG", "Juguete para pareja", ProductKind.SHOP, "450.00", "0.1600", 20, "PRV-05"),
    ("AME-KIT", "Kit de amenidades", ProductKind.AMENITY, "0.00", "0.0000", 300, "PRV-03"),
    ("AME-SHA", "Shampoo individual", ProductKind.AMENITY, "0.00", "0.0000", 400, "PRV-03"),
    ("AME-JAB", "Jabón de tocador", ProductKind.AMENITY, "0.00", "0.0000", 400, "PRV-03"),
    ("AME-CEP", "Cepillo dental", ProductKind.AMENITY, "35.00", "0.1600", 120, "PRV-03"),
    ("LIM-CLO", "Cloro 1 L", ProductKind.CLEANING, "0.00", "0.0000", 90, "PRV-03"),
    ("LIM-DES", "Desinfectante multiusos 5 L", ProductKind.CLEANING, "0.00", "0.0000", 40, "PRV-03"),
    ("LIM-PIN", "Aromatizante en aerosol", ProductKind.CLEANING, "0.00", "0.0000", 70, "PRV-03"),
    ("LIM-PAP", "Papel higiénico institucional", ProductKind.CLEANING, "0.00", "0.0000", 260, "PRV-03"),
    ("BLA-TOA", "Juego de toallas", ProductKind.LINEN, "0.00", "0.0000", 220, "PRV-04"),
    ("BLA-SAB", "Juego de sábanas king", ProductKind.LINEN, "0.00", "0.0000", 180, "PRV-04"),
    ("BLA-COL", "Colcha matrimonial", ProductKind.LINEN, "0.00", "0.0000", 90, "PRV-04"),
    ("BLA-BAT", "Bata de baño", ProductKind.LINEN, "0.00", "0.0000", 60, "PRV-04"),
)

# Lo que se vende de verdad, con su peso. Sin esto todos los productos se
# venden igual y el reporte de más vendidos sale plano, que es justo el reporte
# que alguien quiere ver en una demo.
CANASTA: tuple[tuple[str, int], ...] = (
    ("CERV-355", 30), ("REF-600", 18), ("AGU-1000", 16), ("BOT-PAP", 12),
    ("SEX-PRE", 12), ("CERV-CAG", 8), ("BOT-CAC", 8), ("PIZ-IND", 7),
    ("MICH-PRE", 6), ("ENE-473", 6), ("ALI-BON", 5), ("HAM-SEN", 5),
    ("SEX-LUB", 4), ("AGU-500", 10), ("REF-LAT", 10), ("TEQ-SHO", 5),
    ("SEX-KIT", 2), ("VINO-TIN", 2), ("ALI-PAP", 4), ("BOT-CHI", 6),
    ("SEX-MAS", 2), ("ALI-CLU", 3), ("AME-CEP", 3), ("BOT-GAL", 5),
)

PLACAS = "ABCDEFGHJKLMNPRSTUVWXYZ"

GASTOS: tuple[tuple[str, str, str, str], ...] = (
    (ExpenseCategory.SUPPLIES, "Compra de hielo y limones", "Abarrotes La Central", "180"),
    (ExpenseCategory.SUPPLIES, "Garrafones de agua para oficina", "Agua Pura del Valle", "150"),
    (ExpenseCategory.MAINTENANCE, "Reparación de fuga en habitación", "Plomería Aispuro", "850"),
    (ExpenseCategory.MAINTENANCE, "Cambio de balastras de cochera", "Eléctrica Humaya", "1240"),
    (ExpenseCategory.CLEANING, "Recarga de químicos de limpieza", "Químicos Sinaloa", "620"),
    (ExpenseCategory.UTILITIES, "Recibo de agua potable", "JAPAC", "2350"),
    (ExpenseCategory.TRANSPORT, "Gasolina de camioneta de suministros", "Gasolinera Aeropuerto", "700"),
    (ExpenseCategory.PAYROLL, "Vales de despensa del turno", "Interno", "900"),
    (ExpenseCategory.OTHER, "Papelería y rollos de ticket", "Papelería Zaragoza", "410"),
)

FALLAS: tuple[tuple[str, str, str, str], ...] = (
    ("Aire acondicionado no enfría", MaintenanceCategory.AIR_CONDITIONING,
     MaintenancePriority.HIGH, "El minisplit tira aire pero no baja la temperatura."),
    ("Fuga en la regadera", MaintenanceCategory.PLUMBING, MaintenancePriority.MEDIUM,
     "Gotea de forma constante aunque quede bien cerrada."),
    ("Televisión sin señal", MaintenanceCategory.ELECTRONICS, MaintenancePriority.LOW,
     "La pantalla enciende pero no sintoniza ningún canal."),
    ("Contacto eléctrico flojo", MaintenanceCategory.ELECTRICAL, MaintenancePriority.HIGH,
     "El contacto junto a la cama no sostiene la clavija."),
    ("Cabecera desprendida", MaintenanceCategory.FURNITURE, MaintenancePriority.LOW,
     "Se soltaron dos tornillos del muro."),
    ("Motor del jacuzzi ruidoso", MaintenanceCategory.OTHER, MaintenancePriority.MEDIUM,
     "Trabaja, pero hace un ruido que se oye desde el pasillo."),
    ("Humedad en el plafón", MaintenanceCategory.STRUCTURE, MaintenancePriority.MEDIUM,
     "Mancha creciendo en la esquina del baño."),
    ("Cerradura de cochera atorada", MaintenanceCategory.OTHER, MaintenancePriority.URGENT,
     "La cortina no baja del todo y el cuarto no se puede rentar."),
)

FESTIVOS: tuple[tuple[int, int, str], ...] = (
    (1, 1, "Año nuevo"),
    (2, 14, "Día del amor y la amistad"),
    (5, 1, "Día del trabajo"),
    (5, 10, "Día de las madres"),
    (9, 16, "Independencia"),
    (11, 20, "Revolución"),
    (12, 12, "Día de la Virgen"),
    (12, 25, "Navidad"),
    (12, 31, "Fin de año"),
)

# Los tres turnos, con su fondo de caja y la franja del día en que abren.
TURNOS: tuple[tuple[str, int, int, str], ...] = (
    (ShiftType.MORNING, 7, 15, "1500"),
    (ShiftType.EVENING, 15, 23, "2000"),
    (ShiftType.NIGHT, 23, 31, "2500"),
)


@contextmanager
def reloj_en(momento: datetime) -> Iterator[None]:
    """Corre el bloque como si fuera ``momento``.

    Todo el dominio pregunta la hora por ``timezone.now()`` -- ninguna parte
    importa la función directamente, se verificó --, así que sustituirla aquí
    alcanza para que folios, consecutivos, días de operación y duraciones se
    escriban con la fecha que les toca. Sin esto la historia entera nace hoy y
    los reportes por rango de fechas, que son la mitad de la demo, salen vacíos.
    """
    original = timezone.now
    timezone.now = lambda: momento  # type: ignore[assignment]
    try:
        yield
    finally:
        timezone.now = original  # type: ignore[assignment]


def desglose(total: Decimal) -> dict[str, int]:
    """Reparte un importe en billetes, que es lo que pide el corte de caja."""
    restante = int(total)
    piezas: dict[str, int] = {}
    for valor in (1000, 500, 200, 100, 50, 20, 10, 5, 1):
        cuantos, restante = divmod(restante, valor)
        if cuantos:
            piezas[str(valor)] = cuantos
    return piezas


class Command(BaseCommand):
    help = "Siembra una sucursal grande con semanas de operación, para demostraciones."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--usuario", default="laura.mendoza", help="Cuenta del dueño.")
        parser.add_argument("--password", default="Esmeralda.2026", help="Contraseña de todos.")
        parser.add_argument("--dias", type=int, default=28, help="Días de historia a simular.")
        parser.add_argument("--habitaciones", type=int, default=64, help="Cuántos cuartos.")
        parser.add_argument("--semilla", type=int, default=20260909, help="Semilla del azar.")
        parser.add_argument(
            "--rehacer",
            action="store_true",
            help="Retira la sucursal de ejemplo anterior y siembra una nueva.",
        )

    def handle(self, *args, **options) -> None:
        self.azar = random.Random(options["semilla"])
        self.clave = options["password"]
        existente = Motel.all_objects.filter(slug=SLUG).first()

        if existente is not None and not options["rehacer"]:
            raise CommandError(
                f"'{NOMBRE}' ya existe. Usa --rehacer para retirarla y sembrar otra."
            )
        if existente is not None:
            self._retirar(existente)

        # La siembra pide la configuración del negocio miles de veces, y esa
        # consulta pasa por la caché de Redis. En una máquina de desarrollo
        # Redis rara vez está levantado, y cada fallo cuesta su tiempo de
        # espera: la siembra se vuelve horas de esperar a un servicio que no
        # está. Aquí la caché vive en memoria, que para un proceso de un solo
        # uso es exactamente lo que hace falta.
        memoria = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
        with override_settings(CACHES=memoria), transaction.atomic():
            motel = self._crear_motel(options["usuario"])
            with use_motel(motel):
                self._sembrar(motel, options)

        self._resumen(options)

    def _retirar(self, motel: Motel) -> None:
        """Aparta la sucursal anterior en vez de borrarla.

        Aquí no se borra historial -- es la misma regla que sigue
        ``reset_tenant`` --, así que rehacer la demo no significa destruir la
        anterior: se le cambia el identificador para dejar libre el bueno, se
        suspende y su gente deja de poder entrar. Los usuarios no chocan porque
        el nombre de acceso es único por sucursal, no en todo el sistema.
        """
        from apps.settings.services import deactivate_motel

        numero = Motel.all_objects.filter(slug__startswith=f"{SLUG}-retirada").count() + 1
        motel.slug = f"{SLUG}-retirada-{numero}"
        motel.name = f"{NOMBRE} (retirada {numero})"
        motel.save(update_fields=["slug", "name", "updated_at"])
        deactivate_motel(motel=motel, reason="Reemplazada por una siembra nueva de demostración.")
        self.stdout.write(f"  sucursal anterior retirada como «{motel.slug}»")

    # -- estructura --------------------------------------------------------

    def _crear_motel(self, usuario: str) -> Motel:
        motel = Motel(
            name=NOMBRE,
            slug=SLUG,
            legal_name="Operadora Villa Esmeralda S.A. de C.V.",
            tax_id="OVE210415RT8",
            address="Boulevard Emiliano Zapata 4820, Culiacán, Sinaloa",
            phone="667 220 1188",
            email="contacto@villaesmeralda.mx",
            operation_size="50+",
            currency="MXN",
            locale="es-MX",
            time_zone="America/Mazatlan",
            ticket_footer="Gracias por su visita. Villa Esmeralda.",
            login_message="Bienvenido al sistema de Villa Esmeralda",
            expiration_warning_minutes=20,
            expense_approval_threshold=Decimal("1000.00"),
            # La demo cierra cientos de folios de golpe. Con la impresión
            # encendida, cada cierre intenta hablarle a un impresor que no
            # existe y espera su tiempo de espera: la siembra pasa de segundos
            # a minutos sin que nadie vea un solo ticket.
            print_ticket_on_close=False,
        )
        motel.save()
        self.stdout.write(f"  sucursal {motel.name}")
        return motel

    def _sembrar(self, motel: Motel, options: dict) -> None:
        gente = self._crear_gente(motel, options["usuario"])
        tipos = self._crear_tipos_y_tarifas()
        cuartos = self._crear_habitaciones(tipos, options["habitaciones"])
        self._crear_festivos()
        almacenes = self._crear_almacenes()
        proveedores = self._crear_proveedores()
        productos = self._crear_inventario(almacenes, proveedores, gente["dueña"])
        self._crear_compras(almacenes, proveedores, productos, gente["gerentes"][0])
        self._simular_historia(gente, cuartos, almacenes, productos, options["dias"])
        self._dejar_presente_vivo(gente, cuartos, almacenes, productos)

    def _crear_gente(self, motel: Motel, usuario_dueña: str) -> dict:
        creados: list[User] = []
        for username, nombre, rol, numero in PLANTILLA:
            if username == PLANTILLA[0][0]:
                username = usuario_dueña
            user = User.objects.create_user(
                username=username,
                password=self.clave,
                full_name=nombre,
                role=rol,
                motel=motel,
                email=f"{username}@villaesmeralda.mx",
                phone=f"667 {self.azar.randint(100, 999)} {self.azar.randint(1000, 9999)}",
                employee_number=numero,
                hired_at=date.today() - timedelta(days=self.azar.randint(60, 1400)),
            )
            creados.append(user)
        self.stdout.write(f"  {len(creados)} personas en plantilla")
        return {
            "dueña": creados[0],
            "gerentes": [u for u in creados if u.role == Role.MANAGER],
            "recepcion": [u for u in creados if u.role == Role.RECEPTION],
            "limpieza": [u for u in creados if u.role == Role.HOUSEKEEPING],
            "todos": creados,
        }

    def _crear_tipos_y_tarifas(self) -> dict[str, RoomType]:
        tipos: dict[str, RoomType] = {}
        for nombre, clave, ocupantes, extra, orden, _ in TIPOS:
            tipo = RoomType.objects.create(
                name=nombre,
                code=clave,
                max_occupants=ocupantes,
                extra_person_price=Decimal(extra),
                sort_order=orden,
                description=f"Habitación {nombre.lower()} con cochera privada.",
            )
            tipos[clave] = tipo
            for indice, (bloque, minutos, precio, recargo) in enumerate(TARIFAS[clave]):
                tarifa = TariffBlock.objects.create(
                    room_type=tipo,
                    name=bloque,
                    duration_minutes=minutos,
                    base_price=Decimal(precio),
                    overstay_hour_price=Decimal(recargo),
                    grace_minutes=15,
                    is_overnight=bloque == "Pernocta",
                    is_default=indice == 0,
                    sort_order=indice,
                )
                # Dos reglas por bloque: el fin de semana sube y la madrugada
                # baja. Es lo que hace que la pantalla de tarifas se vea como un
                # tarifario de verdad y no como una lista de precios planos.
                tarifa.rules.create(
                    name="Fin de semana",
                    rule_type=TariffRuleType.WEEKDAY,
                    weekdays=[4, 5, 6],
                    price_mode=PriceMode.MULTIPLIER,
                    value=Decimal("1.20"),
                    priority=100,
                )
                tarifa.rules.create(
                    name="Madrugada",
                    rule_type=TariffRuleType.WEEKDAY,
                    weekdays=[0, 1, 2, 3],
                    start_time=time(2, 0),
                    end_time=time(6, 0),
                    price_mode=PriceMode.MULTIPLIER,
                    value=Decimal("0.85"),
                    priority=50,
                )
        self.stdout.write(f"  {len(tipos)} tipos de habitación con su tarifario")
        return tipos

    def _crear_habitaciones(self, tipos: dict[str, RoomType], cantidad: int) -> list[Room]:
        # El reparto respeta la mezcla declarada en TIPOS y se ajusta al total
        # que pidieron: una sucursal real tiene muchas sencillas y pocas villas.
        plan: list[str] = []
        for _, clave, _, _, _, cuantas in TIPOS:
            plan.extend([clave] * cuantas)
        while len(plan) < cantidad:
            plan.append("SEN")
        plan = plan[:cantidad]
        self.azar.shuffle(plan)

        cuartos: list[Room] = []
        for indice, clave in enumerate(plan):
            piso = indice // 16 + 1
            numero = f"{piso}{indice % 16 + 1:02d}"
            cuartos.append(
                Room.objects.create(
                    number=numero,
                    room_type=tipos[clave],
                    floor=piso,
                    zone=f"Edificio {'ABCD'[piso - 1]}",
                    has_garage=True,
                )
            )
        edificios = len({room.zone for room in cuartos})
        self.stdout.write(f"  {len(cuartos)} habitaciones en {edificios} edificios")
        return cuartos

    def _crear_festivos(self) -> None:
        año = date.today().year
        for mes, dia, nombre in FESTIVOS:
            for delta in (0, 1):
                Holiday.objects.get_or_create(date=date(año + delta, mes, dia), name=nombre)

    def _crear_almacenes(self) -> dict[str, Warehouse]:
        definiciones = (
            ("GEN", "Almacén general", WarehouseType.GENERAL, False),
            ("BAR", "Bar y room service", WarehouseType.BAR, True),
            ("TIE", "Tienda y boutique", WarehouseType.SHOP, False),
            ("AMA", "Bodega de ama de llaves", WarehouseType.HOUSEKEEPING, False),
            ("FRI", "Frigobares de habitación", WarehouseType.MINIBAR, False),
        )
        almacenes: dict[str, Warehouse] = {}
        for codigo, nombre, tipo, ventas in definiciones:
            almacenes[codigo] = Warehouse.objects.create(
                code=codigo, name=nombre, warehouse_type=tipo, is_default_for_sales=ventas
            )
        return almacenes

    def _crear_proveedores(self) -> dict[str, Supplier]:
        proveedores: dict[str, Supplier] = {}
        for codigo, razon, contacto, telefono, credito in PROVEEDORES:
            proveedores[codigo] = Supplier.objects.create(
                code=codigo,
                business_name=razon,
                contact_name=contacto,
                phone=telefono,
                email=f"ventas@{codigo.lower()}.mx",
                payment_terms_days=credito,
                address="Culiacán, Sinaloa",
            )
        return proveedores

    def _crear_inventario(
        self, almacenes: dict[str, Warehouse], proveedores: dict[str, Supplier], actor: User
    ) -> dict[str, Product]:
        categorias: dict[str, ProductCategory] = {}
        productos: dict[str, Product] = {}

        for sku, nombre, familia, precio, impuesto, existencia, _prov in PRODUCTOS:
            if familia not in categorias:
                categorias[familia] = ProductCategory.objects.create(
                    name=ProductKind(familia).label, kind=familia
                )
            venta = Decimal(precio)
            producto = Product.objects.create(
                sku=sku,
                name=nombre,
                category=categorias[familia],
                unit=UnitOfMeasure.PIECE,
                sale_price=venta,
                tax_rate=Decimal(impuesto),
                is_sellable=venta > 0,
                default_min_stock=Decimal("24"),
            )
            productos[sku] = producto

            destino = self._almacen_de(producto, almacenes)
            register_entry(
                product=producto,
                warehouse=destino,
                quantity=Decimal(existencia),
                unit_cost=(venta / Decimal("2.4")) if venta else Decimal("18"),
                actor=actor,
                reason="Inventario inicial",
            )
            stock = producto.stocks.get(warehouse=destino)
            stock.min_stock = Decimal("24")
            stock.save(update_fields=["min_stock", "updated_at"])

        self.stdout.write(f"  {len(productos)} productos con existencia en {len(almacenes)} almacenes")
        return productos

    def _almacen_de(self, producto: Product, almacenes: dict[str, Warehouse]) -> Warehouse:
        familia = producto.category.kind
        if familia == ProductKind.SHOP:
            return almacenes["TIE"]
        if familia in {ProductKind.CLEANING, ProductKind.LINEN, ProductKind.AMENITY}:
            return almacenes["AMA"]
        return almacenes["BAR"]

    def _crear_compras(
        self,
        almacenes: dict[str, Warehouse],
        proveedores: dict[str, Supplier],
        productos: dict[str, Product],
        actor: User,
    ) -> None:
        """Tres compras: una recibida, una a medias y una todavía en camino."""
        por_proveedor: dict[str, list[Product]] = {}
        for sku, _n, _f, _p, _i, _e, codigo in PRODUCTOS:
            por_proveedor.setdefault(codigo, []).append(productos[sku])

        planes = (
            ("PRV-01", "BAR", PurchaseStatus.RECEIVED, 1.0),
            ("PRV-02", "BAR", PurchaseStatus.PARTIAL, 0.5),
            ("PRV-03", "AMA", PurchaseStatus.ORDERED, 0.0),
        )
        hoy = date.today()
        for codigo, almacen, estado, proporcion in planes:
            articulos = por_proveedor[codigo][:6]
            orden = PurchaseOrder.objects.create(
                folio=f"OC-{hoy.strftime('%Y%m')}-{codigo[-2:]}",
                supplier=proveedores[codigo],
                warehouse=almacenes[almacen],
                status=PurchaseStatus.DRAFT,
                order_date=hoy - timedelta(days=self.azar.randint(3, 12)),
                expected_date=hoy + timedelta(days=self.azar.randint(1, 6)),
                supplier_reference=f"REM-{self.azar.randint(10000, 99999)}",
                created_by=actor,
            )
            subtotal = Decimal("0")
            impuestos = Decimal("0")
            for producto in articulos:
                cantidad = Decimal(self.azar.choice([12, 24, 36, 48]))
                costo = money((producto.sale_price or Decimal("40")) / Decimal("2.4"))
                PurchaseOrderItem.objects.create(
                    order=orden,
                    product=producto,
                    quantity=cantidad,
                    unit_cost=costo,
                    tax_rate=producto.tax_rate,
                )
                subtotal += costo * cantidad
                impuestos += costo * cantidad * producto.tax_rate
            orden.subtotal = money(subtotal)
            orden.tax_total = money(impuestos)
            orden.total = money(subtotal + impuestos)
            orden.status = PurchaseStatus.ORDERED
            orden.save()

            if proporcion > 0:
                recepciones = [
                    {"item_id": item.pk, "quantity": money(item.quantity * Decimal(proporcion))}
                    for item in orden.items.all()
                ]
                receive_purchase(order=orden, receipts=recepciones, actor=actor)

        self.stdout.write("  3 órdenes de compra (recibida, parcial y en camino)")

    # -- historia ----------------------------------------------------------

    def _simular_historia(
        self,
        gente: dict,
        cuartos: list[Room],
        almacenes: dict[str, Warehouse],
        productos: dict[str, Product],
        dias: int,
    ) -> None:
        """Corre día por día, turno por turno, con el reloj movido hacia atrás."""
        hoy = timezone.localdate()
        canasta = [productos[sku] for sku, peso in CANASTA for _ in range(peso)]
        libres = list(cuartos)
        gerente = gente["gerentes"][0]

        for atras in range(dias, 0, -1):
            jornada = hoy - timedelta(days=atras)
            # El fin de semana llena la casa; el martes no. Sin esa curva, la
            # gráfica de ocupación sale como una regla y no dice nada.
            finde = jornada.weekday() >= 4
            for tipo_turno, hora_inicio, hora_fin, fondo in TURNOS:
                cajero = self.azar.choice(gente["recepcion"])
                rentas = self.azar.randint(9, 14) if finde else self.azar.randint(4, 8)
                self._simular_turno(
                    jornada=jornada,
                    tipo_turno=tipo_turno,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                    fondo=Decimal(fondo),
                    cajero=cajero,
                    gerente=gerente,
                    gente=gente,
                    cuartos=libres,
                    almacenes=almacenes,
                    canasta=canasta,
                    rentas=rentas,
                )
        self.stdout.write(f"  {dias} días de operación simulados")

    def _simular_turno(self, **k) -> None:
        jornada: date = k["jornada"]
        cajero: User = k["cajero"]
        gerente: User = k["gerente"]
        apertura = self._instante(jornada, k["hora_inicio"], 0)

        with reloj_en(apertura):
            turno = open_shift(
                cashier=cajero,
                opening_balance=k["fondo"],
                shift_type=k["tipo_turno"],
                breakdown=desglose(k["fondo"]),
            )

        minutos_totales = (k["hora_fin"] - k["hora_inicio"]) * 60
        efectivo_cobrado = Decimal("0")

        for numero in range(k["rentas"]):
            avance = int(minutos_totales * (numero + 0.5) / (k["rentas"] + 1))
            entrada = apertura + timedelta(minutes=avance)
            efectivo_cobrado += self._simular_renta(
                entrada=entrada,
                cajero=cajero,
                gente=k["gente"],
                cuartos=k["cuartos"],
                almacenes=k["almacenes"],
                canasta=k["canasta"],
            )

        # Un par de ventas de mostrador por turno: es el otro camino del dinero
        # y sin ellas el corte solo refleja habitaciones.
        for _ in range(self.azar.randint(1, 3)):
            momento = apertura + timedelta(minutes=self.azar.randint(10, minutos_totales - 10))
            efectivo_cobrado += self._venta_mostrador(
                momento, cajero, k["almacenes"], k["canasta"]
            )

        # Gastos y movimientos de caja del turno.
        salidas = Decimal("0")
        with reloj_en(apertura + timedelta(minutes=minutos_totales // 2)):
            if self.azar.random() < 0.55:
                categoria, descripcion, proveedor, importe = self.azar.choice(GASTOS)
                gasto = register_expense(
                    amount=Decimal(importe),
                    description=descripcion,
                    actor=cajero,
                    shift_id=turno.pk,
                    category=categoria,
                    supplier=proveedor,
                    receipt_reference=f"TCK-{self.azar.randint(10000, 99999)}",
                )
                if gasto.requires_approval:
                    # Por encima del umbral nace pendiente, y un turno no cierra
                    # con dinero en el aire: gerencia lo resuelve en el momento.
                    aprobado = self.azar.random() < 0.75
                    gasto = review_expense(
                        expense_id=gasto.pk,
                        approve=aprobado,
                        actor=gerente,
                        notes="Autorizado por gerencia" if aprobado else "Sin comprobante",
                    )
                if gasto.status == "APPROVED":
                    salidas += gasto.amount

            if self.azar.random() < 0.35:
                retiro = Decimal(self.azar.choice([500, 1000, 1500, 2000]))
                if retiro < k["fondo"] + efectivo_cobrado - salidas:
                    register_cash_movement(
                        shift_id=turno.pk,
                        direction=CashDirection.OUT,
                        reason=CashMovementReason.DROP,
                        amount=retiro,
                        actor=cajero,
                        description="Retiro parcial a bóveda",
                    )
                    salidas += retiro

        # El cierre. La diferencia se deja casi siempre en cero y de vez en
        # cuando en un faltante chico: un tablero de arqueos donde nunca falla
        # nada tampoco es creíble.
        cierre = apertura + timedelta(minutes=minutos_totales, seconds=self.azar.randint(60, 900))
        with reloj_en(cierre):
            esperado = k["fondo"] + efectivo_cobrado - salidas
            desvio = Decimal(self.azar.choice([0, 0, 0, 0, 0, -20, -50, 30, 100]))
            declarado = max(Decimal("0"), money(esperado + desvio))
            declarado = Decimal(int(declarado))
            turno = close_shift(
                shift_id=turno.pk,
                declared_cash=declarado,
                actor=cajero,
                breakdown=desglose(declarado),
                notes="Corte entregado a gerencia.",
            )
            if self.azar.random() < 0.8:
                verify_shift(
                    shift_id=turno.pk,
                    counted_cash=declarado,
                    actor=gerente,
                    breakdown=desglose(declarado),
                    notes="Arqueo conforme." if turno.difference == 0 else "Diferencia justificada.",
                )

    def _simular_renta(self, **k) -> Decimal:
        """Una estancia completa: entrada, consumo, cobro, salida y limpieza."""
        entrada: datetime = k["entrada"]
        cajero: User = k["cajero"]
        cuartos: list[Room] = k["cuartos"]

        with reloj_en(entrada):
            disponibles = [
                room
                for room in Room.objects.filter(status=RoomStatus.AVAILABLE).select_related(
                    "room_type"
                )
            ]
            if not disponibles:
                return Decimal("0")
            room = self.azar.choice(disponibles)
            bloque = self.azar.choice(list(room.room_type.tariff_blocks.all()))
            if bloque is None:
                return Decimal("0")

            estancia = rent_room(
                room_id=room.pk,
                tariff_block_id=bloque.pk,
                actor=cajero,
                occupants=self.azar.randint(1, min(2, room.room_type.max_occupants)),
                vehicle_plate=self._placa(),
                vehicle_description=self.azar.choice(
                    ["Sedán gris", "Camioneta blanca", "Sedán rojo", "Pick-up negra",
                     "Hatchback azul", "SUV plata", "Sin vehículo"]
                ),
            )

        # El consumo, un rato después de entrar.
        if self.azar.random() < 0.65:
            with reloj_en(entrada + timedelta(minutes=self.azar.randint(10, 40))):
                articulos = self.azar.sample(k["canasta"], self.azar.randint(1, 3))
                renglones = [
                    {"product_id": p.pk, "quantity": Decimal(self.azar.randint(1, 4))}
                    for p in {p.pk: p for p in articulos}.values()
                ]
                try:
                    create_order(
                        folio_id=estancia.folio.pk,
                        warehouse_id=self._almacen_para(articulos[0], k["almacenes"]).pk,
                        items=renglones,
                        actor=cajero,
                        order_type=self.azar.choice(
                            [OrderType.ROOM_SERVICE, OrderType.MINIBAR, OrderType.SHOP]
                        ),
                    )
                except Exception:
                    # Un producto sin existencia no debe tumbar la siembra: en
                    # la vida real tampoco tumba la noche, solo no se vende.
                    pass

        # Algunas parejas extienden.
        estadia = bloque.duration_minutes
        if self.azar.random() < 0.18:
            with reloj_en(entrada + timedelta(minutes=estadia - 20)):
                try:
                    extend_stay(stay_id=estancia.pk, tariff_block_id=bloque.pk, actor=cajero)
                    estadia += bloque.duration_minutes
                except Exception:
                    pass

        salida = entrada + timedelta(minutes=estadia - self.azar.randint(5, 60))
        with reloj_en(salida):
            estancia.refresh_from_db()
            saldo = estancia.folio.balance
            metodo, efectivo = self._forma_de_pago(saldo)
            checkout_stay(
                stay_id=estancia.pk,
                actor=cajero,
                payments=[{"method": metodo, "amount": saldo, "tendered_amount": saldo}],
            )

        self._limpiar(room, salida, k["gente"])
        return efectivo

    def _limpiar(self, room: Room, desde: datetime, gente: dict) -> None:
        """La habitación pasa por el ama de llaves antes de volver a rentarse."""
        camarista = self.azar.choice(gente["limpieza"])
        supervisora = gente["gerentes"][0]
        tarea = CleaningTask.objects.filter(
            room=room, status__in=[CleaningTaskStatus.PENDING, CleaningTaskStatus.ASSIGNED]
        ).first()
        if tarea is None:
            with reloj_en(desde):
                tarea = create_cleaning_task(room=room, task_type=CleaningTaskType.CHECKOUT)

        with reloj_en(desde + timedelta(minutes=self.azar.randint(2, 12))):
            if tarea.status == CleaningTaskStatus.PENDING:
                tarea = assign_cleaning_task(task_id=tarea.pk, employee=camarista, actor=supervisora)
            tarea = start_cleaning_task(task_id=tarea.pk, actor=camarista)

        with reloj_en(desde + timedelta(minutes=self.azar.randint(20, 55))):
            hallazgos = self.azar.random() < 0.12
            tarea = finish_cleaning_task(
                task_id=tarea.pk,
                actor=camarista,
                notes="Cuarto entregado." if not hallazgos else "Se reporta detalle al supervisor.",
                found_issues=hallazgos,
            )
            if self.azar.random() < 0.55:
                verify_cleaning_task(task_id=tarea.pk, actor=supervisora)

    def _venta_mostrador(
        self, momento: datetime, cajero: User, almacenes: dict, canasta: list[Product]
    ) -> Decimal:
        with reloj_en(momento):
            articulos = self.azar.sample(canasta, self.azar.randint(1, 3))
            renglones = [
                {"product_id": p.pk, "quantity": Decimal(self.azar.randint(1, 3))}
                for p in {p.pk: p for p in articulos}.values()
            ]
            metodo = self.azar.choice(
                [PaymentMethod.CASH, PaymentMethod.CASH, PaymentMethod.CARD]
            )
            try:
                folio = counter_sale(
                    warehouse_id=self._almacen_para(articulos[0], almacenes).pk,
                    items=renglones,
                    method=metodo,
                    actor=cajero,
                )
            except Exception:
                return Decimal("0")
        return folio.total if metodo == PaymentMethod.CASH else Decimal("0")

    def _almacen_para(self, producto: Product, almacenes: dict) -> Warehouse:
        return self._almacen_de(producto, almacenes)

    def _forma_de_pago(self, saldo: Decimal) -> tuple[str, Decimal]:
        """Efectivo casi siempre, tarjeta a veces, cortesía muy de vez en cuando.

        Devuelve además lo que de verdad entra al cajón, porque es lo que el
        corte tiene que cuadrar al cierre.
        """
        tirada = self.azar.random()
        if tirada < 0.72:
            return PaymentMethod.CASH, saldo
        if tirada < 0.94:
            return PaymentMethod.CARD, Decimal("0")
        if tirada < 0.98:
            return PaymentMethod.TRANSFER, Decimal("0")
        return PaymentMethod.COURTESY, Decimal("0")

    def _placa(self) -> str:
        letras = "".join(self.azar.choice(PLACAS) for _ in range(3))
        return f"{letras}{self.azar.randint(100, 999)}"

    def _instante(self, dia: date, hora: int, minuto: int) -> datetime:
        """Convierte una hora local del día de operación en un instante real.

        Las horas mayores a 23 son del turno nocturno, que empieza un día y
        termina en el siguiente: la aritmética lo resuelve sola.
        """
        base = datetime.combine(dia, time(0, 0))
        ingenuo = base + timedelta(hours=hora, minutes=minuto)
        return timezone.make_aware(ingenuo, timezone.get_current_timezone())

    # -- presente ----------------------------------------------------------

    def _dejar_presente_vivo(
        self, gente: dict, cuartos: list[Room], almacenes: dict, productos: dict
    ) -> None:
        """Lo que se ve al entrar: casa medio llena, relojes corriendo y pendientes.

        Una demo que abre con las sesenta y cuatro habitaciones en verde no
        enseña nada. Aquí queda ocupación real, cuartos en limpieza, uno fuera
        de servicio, reportes de mantenimiento en distintas etapas, un turno
        abierto con su caja y reservaciones para los próximos días.
        """
        ahora = timezone.now()
        cajero = gente["recepcion"][0]
        gerente = gente["gerentes"][0]
        canasta = [productos[sku] for sku, peso in CANASTA for _ in range(peso)]

        turno = open_shift(
            cashier=cajero,
            opening_balance=Decimal("2000"),
            shift_type=ShiftType.EVENING,
            breakdown=desglose(Decimal("2000")),
        )

        # Habitaciones ocupadas ahora mismo, con distinto tiempo consumido para
        # que el tablero enseñe verdes, ámbares y alguna vencida.
        disponibles = list(Room.objects.filter(status=RoomStatus.AVAILABLE).select_related("room_type"))
        self.azar.shuffle(disponibles)
        ocupadas = 0
        for room in disponibles[:26]:
            bloque = self.azar.choice(list(room.room_type.tariff_blocks.all()))
            transcurrido = self.azar.randint(15, bloque.duration_minutes + 30)
            entrada = ahora - timedelta(minutes=transcurrido)
            estancia = rent_room(
                room_id=room.pk,
                tariff_block_id=bloque.pk,
                actor=cajero,
                occupants=self.azar.randint(1, 2),
                vehicle_plate=self._placa(),
                vehicle_description=self.azar.choice(
                    ["Sedán gris", "Camioneta blanca", "SUV negra", "Sin vehículo"]
                ),
                check_in_at=entrada,
            )
            if self.azar.random() < 0.5:
                articulos = self.azar.sample(canasta, self.azar.randint(1, 3))
                renglones = [
                    {"product_id": p.pk, "quantity": Decimal(self.azar.randint(1, 3))}
                    for p in {p.pk: p for p in articulos}.values()
                ]
                try:
                    create_order(
                        folio_id=estancia.folio.pk,
                        warehouse_id=self._almacen_de(articulos[0], almacenes).pk,
                        items=renglones,
                        actor=cajero,
                        order_type=OrderType.ROOM_SERVICE,
                    )
                except Exception:
                    pass
            ocupadas += 1

        # Cuartos en limpieza, en distintas etapas del proceso.
        pendientes = [r for r in Room.objects.filter(status=RoomStatus.AVAILABLE)][:7]
        for indice, room in enumerate(pendientes):
            room.status = RoomStatus.CLEANING
            room.status_changed_at = ahora - timedelta(minutes=self.azar.randint(5, 40))
            room.save(update_fields=["status", "status_changed_at", "updated_at"])
            tarea = create_cleaning_task(room=room, task_type=CleaningTaskType.CHECKOUT)
            if indice % 3 != 0:
                tarea = assign_cleaning_task(
                    task_id=tarea.pk,
                    employee=self.azar.choice(gente["limpieza"]),
                    actor=gerente,
                )
            if indice % 3 == 2:
                start_cleaning_task(task_id=tarea.pk, actor=tarea.assigned_to)

        # Limpiezas profundas programadas: trabajo que no viene de una salida.
        for room in [r for r in Room.objects.filter(status=RoomStatus.AVAILABLE)][:4]:
            create_cleaning_task(
                room=room,
                task_type=self.azar.choice([CleaningTaskType.DEEP, CleaningTaskType.INSPECTION]),
                actor=gerente,
                priority=50,
                notes="Programada por gerencia.",
            )

        # Mantenimiento: uno bloquea la habitación, los demás están en curso.
        libres = [r for r in Room.objects.filter(status=RoomStatus.AVAILABLE)]
        for indice, (titulo, categoria, prioridad, detalle) in enumerate(FALLAS):
            room = libres[indice] if indice < len(libres) else None
            bloquea = indice == 0
            reporte = report_maintenance(
                title=titulo,
                description=detalle,
                actor=self.azar.choice(gente["limpieza"] + gente["recepcion"]),
                room_id=room.pk if room else None,
                category=categoria,
                priority=prioridad,
                blocks_room=bloquea,
            )
            # El flujo no salta pasos: un reporte llega a "resuelto" pasando
            # por recibido y en atención. Se camina la cadena hasta donde le
            # toque a cada uno, para que el tablero tenga reportes en las cuatro
            # etapas y no todos en la primera.
            camino = [
                MaintenanceStatus.ACKNOWLEDGED,
                MaintenanceStatus.IN_PROGRESS,
                MaintenanceStatus.RESOLVED,
            ][: indice % 4]
            for paso in camino:
                update_maintenance_status(
                    report_id=reporte.pk,
                    new_status=paso,
                    actor=gerente,
                    note="Seguimiento de gerencia.",
                    assigned_to=gerente if paso == MaintenanceStatus.IN_PROGRESS else None,
                    resolution_notes=(
                        "Atendido por el técnico de planta."
                        if paso == MaintenanceStatus.RESOLVED
                        else ""
                    ),
                    cost=(
                        Decimal(self.azar.choice([350, 600, 900]))
                        if paso == MaintenanceStatus.RESOLVED
                        else Decimal("0")
                    ),
                )

        # Una habitación fuera de servicio por remodelación, que es un estado
        # distinto al de mantenimiento correctivo.
        restantes = [r for r in Room.objects.filter(status=RoomStatus.AVAILABLE)]
        if restantes:
            set_room_out_of_service(
                room_id=restantes[-1].pk,
                actor=gerente,
                reason="Remodelación de baño programada",
                blocked=True,
            )

        # Reservaciones de los próximos días.
        tipos = list(RoomType.objects.all())
        for indice in range(14):
            tipo = self.azar.choice(tipos)
            bloque = tipo.tariff_blocks.first()
            inicio = ahora + timedelta(days=self.azar.randint(1, 10), hours=self.azar.randint(1, 20))
            try:
                create_reservation(
                    room_type_id=tipo.pk,
                    scheduled_start=inicio,
                    scheduled_end=inicio + timedelta(minutes=bloque.duration_minutes),
                    actor=self.azar.choice(gente["recepcion"]),
                    tariff_block_id=bloque.pk,
                    guest_name=self.azar.choice(
                        ["Reserva Fernández", "Reserva Corrales", "Reserva Beltrán",
                         "Reserva Osuna", "Reserva Palazuelos", "Reserva Ibarra"]
                    ),
                    guest_phone=f"667 {self.azar.randint(100, 999)} {self.azar.randint(1000, 9999)}",
                    occupants=2,
                    deposit_amount=Decimal(self.azar.choice([0, 200, 300, 500])),
                    notes="Confirmada por teléfono." if indice % 2 else "",
                )
            except Exception:
                continue

        # Una merma reciente, para que el inventario tenga algo que explicar.
        try:
            register_waste(
                product=productos["PIZ-IND"],
                warehouse=almacenes["BAR"],
                quantity=Decimal("2"),
                actor=gerente,
                reason="Caducidad en refrigerador de barra",
            )
        except Exception:
            pass

        # Un gasto esperando firma: es la pantalla de aprobaciones con algo que
        # aprobar, que si no aparece siempre vacía.
        register_expense(
            amount=Decimal("2680"),
            description="Servicio del minisplit del edificio B",
            actor=cajero,
            shift_id=turno.pk,
            category=ExpenseCategory.MAINTENANCE,
            supplier="Clima y Refrigeración Culiacán",
            receipt_reference="F-4471",
        )

        self.stdout.write(
            f"  presente: {ocupadas} habitaciones ocupadas, 7 en limpieza, "
            "8 reportes de mantenimiento y 14 reservaciones"
        )

    # -- salida ------------------------------------------------------------

    def _resumen(self, options: dict) -> None:
        linea = "-" * 58
        self.stdout.write(self.style.SUCCESS(f"\n{linea}"))
        self.stdout.write(self.style.SUCCESS(f"  {NOMBRE} lista para enseñarse"))
        self.stdout.write(self.style.SUCCESS(linea))
        self.stdout.write(f"  Usuario dueña : {options['usuario']}")
        self.stdout.write(f"  Contraseña    : {self.clave}")
        self.stdout.write("")
        self.stdout.write("  Toda la plantilla comparte la misma contraseña:")
        for username, nombre, rol, _ in PLANTILLA[1:]:
            self.stdout.write(f"    {username:<18} {Role(rol).label:<20} {nombre}")
        self.stdout.write(f"{linea}\n")
