from apps.corporate.models import CorporateAccess, RegionMotel
from apps.settings.models import Motel


def accessible_motel_ids(user) -> set[int]:
    if user.is_platform_admin:
        return set(Motel.objects.values_list("id", flat=True))
    accesses = CorporateAccess.objects.filter(user=user, is_active=True)
    direct = accesses.filter(motel__isnull=False).values_list("motel_id", flat=True)
    regions = accesses.filter(region__isnull=False).values_list("region_id", flat=True)
    regional = RegionMotel.objects.filter(
        is_active=True, region_id__in=regions, motel__is_active=True
    ).values_list("motel_id", flat=True)
    return set(direct) | set(regional)


def access_role(user, motel_id: int) -> str | None:
    direct = CorporateAccess.objects.filter(
        user=user, motel_id=motel_id, is_active=True
    ).values_list("role", flat=True).first()
    if direct:
        return direct
    return CorporateAccess.objects.filter(
        user=user,
        region__memberships__motel_id=motel_id,
        region__memberships__is_active=True,
        is_active=True,
    ).values_list("role", flat=True).first()
