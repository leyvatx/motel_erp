"""Roles del sistema y catalogo de permisos granulares.

El rol define *qué puede hacer* un usuario. La matriz completa
(rol -> permisos) se aplica en la Fase 6 desde ``common.permissions``.
"""

from django.db import models


class Role(models.TextChoices):
    SUPERADMIN = "SUPERADMIN", "Super administrador"
    MANAGER = "MANAGER", "Gerente"
    RECEPTION = "RECEPTION", "Recepción"
    HOUSEKEEPING = "HOUSEKEEPING", "Ama de llaves"


#: Roles que pueden operar caja y cobrar.
CASHIER_ROLES = frozenset({Role.SUPERADMIN, Role.MANAGER, Role.RECEPTION})

#: Roles con visibilidad de reportes gerenciales y cortes ciegos.
MANAGEMENT_ROLES = frozenset({Role.SUPERADMIN, Role.MANAGER})

#: Roles que atienden tareas de limpieza y mantenimiento.
HOUSEKEEPING_ROLES = frozenset({Role.SUPERADMIN, Role.MANAGER, Role.HOUSEKEEPING})


class PermissionCode(models.TextChoices):
    """Acciones sensibles verificables de forma granular."""

    ROOM_RENT = "room.rent", "Rentar habitación"
    ROOM_EXTEND = "room.extend", "Extender renta"
    ROOM_CHECKOUT = "room.checkout", "Cerrar renta"
    ROOM_CANCEL = "room.cancel", "Cancelar renta"
    ROOM_FORCE_STATUS = "room.force_status", "Forzar estado de habitación"
    RESERVATION_MANAGE = "reservation.manage", "Administrar reservaciones"
    FOLIO_CHARGE = "folio.charge", "Agregar consumos al folio"
    FOLIO_DISCOUNT = "folio.discount", "Aplicar descuentos"
    FOLIO_VOID = "folio.void", "Cancelar consumos"
    PAYMENT_REGISTER = "payment.register", "Registrar pagos"
    INVENTORY_VIEW = "inventory.view", "Consultar inventario"
    INVENTORY_MOVE = "inventory.move", "Registrar movimientos de inventario"
    INVENTORY_WASTE = "inventory.waste", "Registrar mermas"
    HOUSEKEEPING_TASK = "housekeeping.task", "Operar tareas de limpieza"
    MAINTENANCE_REPORT = "maintenance.report", "Reportar mantenimiento"
    SHIFT_OPEN = "shift.open", "Abrir turno"
    SHIFT_CLOSE = "shift.close", "Cerrar turno"
    EXPENSE_REGISTER = "expense.register", "Registrar gastos"
    EXPENSE_APPROVE = "expense.approve", "Aprobar gastos"
    REPORT_VIEW = "report.view", "Ver reportes gerenciales"
    AUDIT_VIEW = "audit.view", "Consultar bitácora de auditoría"
    CONFIG_MANAGE = "config.manage", "Administrar configuración y tarifas"
    USER_MANAGE = "user.manage", "Administrar usuarios"
    SHIFT_VERIFY = "shift.verify", "Arquear y verificar turnos"
    CASH_MOVE = "cash.move", "Registrar entradas y salidas de efectivo"


#: Matriz rol -> permisos. Es la única fuente de verdad de quién puede qué.
#:
#: Criterio: recepción opera el día a día y su propia caja; ama de llaves solo
#: toca su tablero; todo lo que implique perdonar dinero, ajustar inventario o
#: revisar a otros queda en gerencia.
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Role.SUPERADMIN: frozenset(PermissionCode.values),
    Role.MANAGER: frozenset(PermissionCode.values) - {PermissionCode.USER_MANAGE},
    Role.RECEPTION: frozenset(
        {
            PermissionCode.ROOM_RENT,
            PermissionCode.ROOM_EXTEND,
            PermissionCode.ROOM_CHECKOUT,
            PermissionCode.ROOM_CANCEL,
            PermissionCode.RESERVATION_MANAGE,
            PermissionCode.FOLIO_CHARGE,
            PermissionCode.FOLIO_VOID,
            PermissionCode.PAYMENT_REGISTER,
            PermissionCode.INVENTORY_VIEW,
            PermissionCode.HOUSEKEEPING_TASK,
            PermissionCode.MAINTENANCE_REPORT,
            PermissionCode.SHIFT_OPEN,
            PermissionCode.SHIFT_CLOSE,
            PermissionCode.EXPENSE_REGISTER,
            PermissionCode.CASH_MOVE,
        }
    ),
    Role.HOUSEKEEPING: frozenset(
        {
            PermissionCode.HOUSEKEEPING_TASK,
            PermissionCode.MAINTENANCE_REPORT,
            PermissionCode.INVENTORY_VIEW,
        }
    ),
}


def permissions_for(user) -> frozenset[str]:
    """Permisos efectivos de un usuario."""
    if getattr(user, "is_superuser", False):
        return frozenset(PermissionCode.values)
    return ROLE_PERMISSIONS.get(getattr(user, "role", None), frozenset())
