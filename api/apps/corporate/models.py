from django.core.exceptions import ValidationError
from django.db import models

from apps.users.constants import Role
from common.models import AuthorStampedModel, SoftDeleteModel, TimeStampedModel


class CorporateManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)


class CorporateModel(TimeStampedModel, AuthorStampedModel, SoftDeleteModel):
    objects = CorporateManager()
    all_objects = models.Manager()

    class Meta(SoftDeleteModel.Meta):
        abstract = True
        base_manager_name = "all_objects"


class MotelGroup(CorporateModel):
    code = models.CharField("Clave", max_length=20)
    name = models.CharField("Nombre", max_length=120, db_index=True)
    description = models.CharField("Descripción", max_length=255, blank=True)

    class Meta(CorporateModel.Meta):
        verbose_name = "Grupo de moteles"
        verbose_name_plural = "Grupos de moteles"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["code"], condition=models.Q(is_active=True), name="uniq_active_group_code"
            )
        ]

    def __str__(self):
        return self.name


class MotelRegion(CorporateModel):
    group = models.ForeignKey(MotelGroup, on_delete=models.PROTECT, related_name="regions")
    code = models.CharField("Clave", max_length=20)
    name = models.CharField("Nombre", max_length=120, db_index=True)
    description = models.CharField("Descripción", max_length=255, blank=True)

    class Meta(CorporateModel.Meta):
        verbose_name = "Región"
        verbose_name_plural = "Regiones"
        ordering = ["group__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "code"],
                condition=models.Q(is_active=True),
                name="uniq_active_region_code_group",
            )
        ]

    def __str__(self):
        return f"{self.group.name} / {self.name}"


class RegionMotel(CorporateModel):
    region = models.ForeignKey(MotelRegion, on_delete=models.CASCADE, related_name="memberships")
    motel = models.OneToOneField(
        "settings.Motel", on_delete=models.CASCADE, related_name="corporate_membership"
    )

    class Meta(CorporateModel.Meta):
        verbose_name = "Motel de región"
        verbose_name_plural = "Moteles de región"
        ordering = ["region", "motel__name"]


class CorporateAccess(CorporateModel):
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="corporate_accesses"
    )
    region = models.ForeignKey(
        MotelRegion,
        on_delete=models.CASCADE,
        related_name="user_accesses",
        null=True,
        blank=True,
    )
    motel = models.ForeignKey(
        "settings.Motel",
        on_delete=models.CASCADE,
        related_name="corporate_accesses",
        null=True,
        blank=True,
    )
    role = models.CharField("Rol en las propiedades", max_length=20, choices=Role.choices)

    class Meta(CorporateModel.Meta):
        verbose_name = "Acceso corporativo"
        verbose_name_plural = "Accesos corporativos"
        ordering = ["user__full_name"]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(region__isnull=False, motel__isnull=True) | models.Q(region__isnull=True, motel__isnull=False)),
                name="corporate_access_exact_scope",
            ),
            models.UniqueConstraint(
                fields=["user", "region"],
                condition=models.Q(region__isnull=False, is_active=True),
                name="uniq_active_user_region_access",
            ),
            models.UniqueConstraint(
                fields=["user", "motel"],
                condition=models.Q(motel__isnull=False, is_active=True),
                name="uniq_active_user_motel_access",
            ),
        ]

    def clean(self):
        if self.user_id and self.user.motel_id is not None:
            raise ValidationError("El usuario corporativo no debe pertenecer a un motel fijo.")

    def __str__(self):
        scope = self.region or self.motel
        return f"{self.user} → {scope}"
