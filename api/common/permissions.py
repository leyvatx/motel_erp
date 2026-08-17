"""Permisos granulares por rol y por acción.

Cada vista declara que permiso exige cada una de sus acciones:

```python
class StayViewSet(...):
    required_permissions = {
        "read": [PermissionCode.ROOM_RENT],
        "rent": [PermissionCode.ROOM_RENT],
        "cancel": [PermissionCode.ROOM_CANCEL],
    }
```

Claves reconocidas, en orden de prioridad:
1. el nombre exacto de la acción (``rent``, ``create``, ``list``...),
2. ``read`` para métodos seguros y ``write`` para los demas,
3. ``*`` como comodin.

Si nada aplica, basta con estar autenticado: los catalogos de consulta no
necesitan permiso especial.
"""

from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.users.constants import PermissionCode, permissions_for

__all__ = [
    "HasPermission",
    "IsAuthenticatedActive",
    "IsManagement",
    "PermissionCode",
    "ReadOnlyOrManagement",
    "RoleRequired",
]


class IsAuthenticatedActive(BasePermission):
    """Usuario autenticado y vigente (no dado de baja)."""

    message = "Se requiere una sesión activa."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


class HasPermission(BasePermission):
    """Valida el permiso concreto que exige la acción solicitada."""

    message = "Tu rol no tiene permiso para esta operación."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False

        required = self._required_permissions(request, view)
        if not required:
            return True

        concedidos = permissions_for(user)
        faltantes = [code for code in required if code not in concedidos]
        if faltantes:
            self.message = (
                "Tu rol no tiene permiso para esta operación "
                f"(requiere: {', '.join(faltantes)})."
            )
            return False
        return True

    @staticmethod
    def _required_permissions(request, view) -> list[str]:
        matriz = getattr(view, "required_permissions", None)
        if not matriz:
            return []

        accion = getattr(view, "action", None) or request.method.lower()
        if accion in matriz:
            return list(matriz[accion])

        clave = "read" if request.method in SAFE_METHODS else "write"
        if clave in matriz:
            return list(matriz[clave])

        return list(matriz.get("*", []))


class RoleRequired(BasePermission):
    """Restringe por rol usando ``allowed_roles`` en la vista."""

    message = "Tu rol no tiene acceso a esta operación."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        if user.is_superuser:
            return True
        allowed = getattr(view, "allowed_roles", None)
        return not allowed or user.role in allowed


class IsManagement(BasePermission):
    """Solo SuperAdmin y Gerente."""

    message = "Operación reservada a gerencia."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.is_management)


class ReadOnlyOrManagement(BasePermission):
    """Lectura para cualquier usuario vigente; escritura solo gerencia."""

    message = "Solo gerencia puede modificar este catalogo."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        return request.method in SAFE_METHODS or user.is_management
