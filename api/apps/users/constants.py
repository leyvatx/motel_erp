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


CASHIER_ROLES = frozenset({Role.SUPERADMIN, Role.MANAGER, Role.RECEPTION})

MANAGEMENT_ROLES = frozenset({Role.SUPERADMIN, Role.MANAGER})

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
    MOTEL_MANAGE = "motel.manage", "Dar de alta y administrar moteles"
    SHIFT_VERIFY = "shift.verify", "Arquear y verificar turnos"
    CASH_MOVE = "cash.move", "Registrar entradas y salidas de efectivo"


ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Role.SUPERADMIN: frozenset(PermissionCode.values) - {PermissionCode.MOTEL_MANAGE},
    Role.MANAGER: frozenset(PermissionCode.values)
    - {PermissionCode.USER_MANAGE, PermissionCode.MOTEL_MANAGE},
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
    """Permisos efectivos de un usuario.

    Administrar moteles es de la plataforma: ni el dueño de un motel lo tiene,
    porque desde ahí se veria y editaria la competencia.
    """
    platform = getattr(user, "is_superuser", False) and getattr(user, "motel_id", None) is None
    if platform:
        return frozenset(PermissionCode.values)

    granted = ROLE_PERMISSIONS.get(getattr(user, "role", None), frozenset())
    if getattr(user, "is_superuser", False):
        granted = frozenset(PermissionCode.values) - {PermissionCode.MOTEL_MANAGE}
    return granted
