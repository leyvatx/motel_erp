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
    **fields,
) -> Motel:
    """Da de alta un motel junto con el usuario dueño que lo va a operar.

    Van en la misma transacción a proposito: un motel sin nadie que pueda
    entrar no le sirve a nadie, y quedaria como basura en la base.
    """
    from apps.users.models import User

    motel = Motel(**fields)
    if actor is not None and getattr(actor, "is_authenticated", False):
        motel.created_by = actor
    motel.save()

    User.objects.create_user(
        username=owner_username,
        password=owner_password,
        full_name=owner_full_name,
        role=Role.SUPERADMIN,
        motel=motel,
    )

    return motel


@transaction.atomic
def deactivate_motel(*, motel: Motel, actor=None, reason: str = "") -> Motel:
    """Suspende un motel y con él el acceso de todos sus empleados."""
    from apps.users.models import User

    motel.soft_delete(user=actor, reason=reason)
    User.all_objects.filter(motel=motel).update(is_active=False)
    return motel
