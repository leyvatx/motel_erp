from django.db import transaction
from rest_framework import serializers

from apps.corporate.models import CorporateAccess, MotelGroup, MotelRegion, RegionMotel
from apps.settings.models import Motel
from apps.users.constants import Role
from apps.users.models import User


class MotelGroupSerializer(serializers.ModelSerializer):
    region_count = serializers.IntegerField(read_only=True, default=0)
    motel_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = MotelGroup
        fields = ("id", "code", "name", "description", "region_count", "motel_count")


class MotelRegionSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    motel_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = MotelRegion
        fields = ("id", "group", "group_name", "code", "name", "description", "motel_count")


class RegionMotelSerializer(serializers.ModelSerializer):
    motel_name = serializers.CharField(source="motel.name", read_only=True)
    motel_slug = serializers.CharField(source="motel.slug", read_only=True)
    region_name = serializers.CharField(source="region.name", read_only=True)
    group_name = serializers.CharField(source="region.group.name", read_only=True)

    class Meta:
        model = RegionMotel
        fields = ("id", "region", "region_name", "group_name", "motel", "motel_name", "motel_slug")


class AssignMotelsSerializer(serializers.Serializer):
    motel_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=True
    )

    def validate_motel_ids(self, value):
        ids = list(dict.fromkeys(value))
        found = set(Motel.objects.filter(pk__in=ids).values_list("pk", flat=True))
        missing = set(ids) - found
        if missing:
            raise serializers.ValidationError(f"Moteles inexistentes o inactivos: {sorted(missing)}")
        return ids


class CorporateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)
    region = serializers.PrimaryKeyRelatedField(
        queryset=MotelRegion.objects.all(), write_only=True, required=False
    )
    access_role = serializers.ChoiceField(choices=Role.choices, write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "id", "username", "full_name", "email", "phone", "role", "password",
            "region", "access_role", "is_active",
        )
        read_only_fields = ("id", "is_active")

    def validate_role(self, value):
        if value not in {Role.MANAGER, Role.RECEPTION, Role.HOUSEKEEPING}:
            raise serializers.ValidationError("Selecciona un rol corporativo válido.")
        return value

    def validate_username(self, value):
        username = value.strip().lower()
        queryset = User.all_objects.filter(username=username)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ese usuario ya existe.")
        return username

    def validate(self, attrs):
        if self.instance is None and not attrs.get("region"):
            raise serializers.ValidationError({"region": "Asigna una región inicial."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password", None)
        region = validated_data.pop("region")
        access_role = validated_data.pop("access_role", validated_data.get("role", Role.RECEPTION))
        user = User.objects.create_user(password=password, motel=None, **validated_data)
        CorporateAccess.objects.create(user=user, region=region, role=access_role)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("region", None)
        validated_data.pop("access_role", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CorporateAccessSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    region_name = serializers.CharField(source="region.name", read_only=True)
    motel_name = serializers.CharField(source="motel.name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = CorporateAccess
        fields = (
            "id", "user", "user_name", "username", "region", "region_name",
            "motel", "motel_name", "role", "role_display",
        )

    def validate_user(self, value):
        if value.motel_id is not None or value.is_platform_admin:
            raise serializers.ValidationError("Selecciona un usuario corporativo.")
        return value

    def validate(self, attrs):
        region = attrs.get("region", getattr(self.instance, "region", None))
        motel = attrs.get("motel", getattr(self.instance, "motel", None))
        if (region is None) == (motel is None):
            raise serializers.ValidationError("Selecciona una región o un motel, no ambos.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        instance = CorporateAccess(**validated_data)
        instance.full_clean()
        instance.save()
        return instance


class AccessibleMotelSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
    group_id = serializers.IntegerField(allow_null=True)
    group_name = serializers.CharField(allow_null=True)
    region_id = serializers.IntegerField(allow_null=True)
    region_name = serializers.CharField(allow_null=True)
    access_role = serializers.CharField(allow_null=True)


BULK_CONFIG_FIELDS = (
    "brand_primary_color", "brand_sidebar_color", "status_available_color",
    "status_occupied_color", "status_cleaning_color", "status_maintenance_color",
    "default_theme", "default_density", "border_radius", "font_family",
    "login_message", "currency", "locale", "time_zone", "ticket_footer",
    "print_ticket_on_close", "expiration_warning_minutes", "expense_approval_threshold",
)


class BulkConfigSerializer(serializers.Serializer):
    motel_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=False
    )
    region_id = serializers.IntegerField(min_value=1, required=False)
    changes = serializers.DictField(allow_empty=False)
    dry_run = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if bool(attrs.get("motel_ids")) == bool(attrs.get("region_id")):
            raise serializers.ValidationError("Selecciona una región o una lista de moteles.")
        unknown = set(attrs["changes"]) - set(BULK_CONFIG_FIELDS)
        if unknown:
            raise serializers.ValidationError(
                {"changes": f"Campos no permitidos: {', '.join(sorted(unknown))}"}
            )
        return attrs
