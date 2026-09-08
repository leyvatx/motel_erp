"""Alta y baja de moteles. Solo la plataforma opera aquí."""

from __future__ import annotations

from django.db import transaction

from apps.settings.models import Motel
from apps.users.constants import Role


@transaction.atomic
def create_motel(
    *,
    actor=None,
    owner_username: str,
    owner_full_name: str,
    owner_password: str,
    owner_email: str = "",
    **fields,
) -> Motel:
    """Da de alta un motel junto con el usuario dueño que lo va a operar.

    Van en la misma transacción a proposito: un motel sin nadie que pueda
    entrar no le sirve a nadie, y quedaria como basura en la base.
    """
    from apps.inventory.constants import WarehouseType
    from apps.inventory.models import Warehouse
    from apps.users.models import User

    motel = Motel(**fields)
    if actor is not None and getattr(actor, "is_authenticated", False):
        motel.created_by = actor
    motel.save()

    User.objects.create_user(
        username=owner_username,
        password=owner_password,
        full_name=owner_full_name,
        email=owner_email,
        role=Role.SUPERADMIN,
        motel=motel,
    )

    # Y un almacén del que vender desde el primer día.
    #
    # El punto de venta descuenta de un almacén: sin ninguno, "Cobrar" se veía
    # habilitado y reventaba siempre, y el negocio recién dado de alta no podía
    # vender ni un refresco hasta que alguien adivinara que primero había que
    # crear un almacén en Inventarios. Se crea aquí, con el motel, porque es
    # parte de poder operar y no una preferencia que alguien vaya a configurar.
    Warehouse.objects.create(
        motel=motel,
        code="GEN",
        name="Almacén general",
        warehouse_type=WarehouseType.GENERAL,
        is_default_for_sales=True,
    )

    return motel


@transaction.atomic
def deactivate_motel(*, motel: Motel, actor=None, reason: str = "") -> Motel:
    """Suspende un motel y con él el acceso de todos sus empleados."""
    from apps.users.models import User

    motel.soft_delete(user=actor, reason=reason)
    User.all_objects.filter(motel=motel).update(is_active=False)
    return motel
