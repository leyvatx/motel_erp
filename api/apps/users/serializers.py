"""Serializadores de autenticación y administración de usuarios."""

from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.users.constants import Role
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    motel_name = serializers.CharField(source="motel.name", read_only=True, default=None)
    motel_slug = serializers.CharField(source="motel.slug", read_only=True, default=None)
    is_platform_admin = serializers.BooleanField(read_only=True)
    is_corporate_user = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "phone",
            "role",
            "role_display",
            "motel",
            "motel_name",
            "motel_slug",
            "is_platform_admin",
            "is_corporate_user",
            "employee_number",
            "hired_at",
            "is_active",
            "is_staff",
            "must_change_password",
            "last_login",
            "created_at",
        )
        read_only_fields = (
            "id",
            "motel",
            "last_login",
            "created_at",
            "is_staff",
            "is_platform_admin",
            "is_corporate_user",
        )


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "phone",
            "role",
            "employee_number",
            "hired_at",
            "password",
            "must_change_password",
        )

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate(self, attrs: dict) -> dict:
        instance = self.instance
        if (
            instance is not None
            and instance.role == Role.SUPERADMIN
            and attrs.get("role", instance.role) != Role.SUPERADMIN
            and not User.all_objects.filter(
                motel_id=instance.motel_id,
                role=Role.SUPERADMIN,
                is_active=True,
            ).exclude(pk=instance.pk).exists()
        ):
            raise serializers.ValidationError(
                {"role": "El motel debe conservar al menos un super administrador activo."}
            )
        return attrs

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance: User, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = False
        instance.save()
        return instance


class MotelTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Agrega el perfil del usuario a la respuesta del login."""

    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs: dict) -> dict:
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserPresenceSerializer(serializers.Serializer):
    """Estado de conexión de un compañero de turno."""

    user_id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    full_name = serializers.CharField(source="user.full_name")
    role = serializers.CharField(source="user.role")
    role_display = serializers.CharField(source="user.get_role_display")
    is_online = serializers.BooleanField()
    last_seen_at = serializers.DateTimeField(allow_null=True)
    last_section = serializers.CharField(allow_blank=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_current_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value


class RoleOptionSerializer(serializers.Serializer):
    """Catalogo de roles para los selectores del frontend."""

    value = serializers.ChoiceField(choices=Role.choices)
    label = serializers.CharField()
