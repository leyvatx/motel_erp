"""Endpoints de autenticación y administración de usuarios."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from common.middleware import get_current_ip, get_current_user_agent
from common.tenancy import current_motel_id

from apps.users.constants import PermissionCode, Role
from apps.users.models import User, UserActivity
from apps.users.serializers import (
    ChangePasswordSerializer,
    MotelTokenObtainPairSerializer,
    RoleOptionSerializer,
    UserPresenceSerializer,
    UserSerializer,
    UserWriteSerializer,
)


class LoginView(TokenObtainPairView):
    """Obtiene el par de tokens JWT y registra el acceso."""

    serializer_class = MotelTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs) -> Response:
        username = (request.data.get("username") or "").strip().lower()
        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            user = User.all_objects.filter(pk=response.data["user"]["id"]).first()
            if user is not None:
                user.last_login_ip = get_current_ip()
                user.save(update_fields=["last_login_ip", "updated_at"])
            UserActivity.objects.create(
                user=user,
                username_attempted=username,
                action=UserActivity.Action.LOGIN,
                ip_address=get_current_ip(),
                user_agent=get_current_user_agent(),
            )
        else:
            UserActivity.objects.create(
                username_attempted=username,
                action=UserActivity.Action.LOGIN_FAILED,
                ip_address=get_current_ip(),
                user_agent=get_current_user_agent(),
            )
        return response


class LogoutView(APIView):
    """Invalida el refresh token (lo manda a la blacklist)."""

    allow_platform_scope = True

    @extend_schema(
        request={"application/json": {"type": "object", "properties": {"refresh": {"type": "string"}}}},
        responses={204: OpenApiResponse(description="Sesión cerrada")},
    )
    def post(self, request) -> Response:
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        UserActivity.objects.create(
            user=request.user,
            action=UserActivity.Action.LOGOUT,
            ip_address=get_current_ip(),
            user_agent=get_current_user_agent(),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """Perfil del usuario autenticado."""

    allow_platform_scope = True

    @extend_schema(responses=UserSerializer)
    def get(self, request) -> Response:
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    allow_platform_scope = True

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={204: OpenApiResponse(description="Contraseña actualizada")},
    )
    def post(self, request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password", "updated_at"])

        UserActivity.objects.create(
            user=user,
            action=UserActivity.Action.PASSWORD_CHANGED,
            ip_address=get_current_ip(),
            user_agent=get_current_user_agent(),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoleListView(APIView):
    """Catalogo de roles disponibles."""

    allow_platform_scope = True

    @extend_schema(responses=RoleOptionSerializer(many=True))
    def get(self, request) -> Response:
        data = [{"value": value, "label": label} for value, label in Role.choices]
        return Response(RoleOptionSerializer(data, many=True).data)


class TeamPresenceView(APIView):
    """Quién está conectado ahora mismo.

    Visible para cualquier empleado con sesión: saber si ya llegó el cajero
    del siguiente turno o si ama de llaves está en línea es información de
    coordinación, no un dato sensible.
    """

    @extend_schema(responses=UserPresenceSerializer(many=True))
    def get(self, request) -> Response:
        from apps.users import presence

        presence.ensure_rows()
        filas = [
            {
                "user": fila.user,
                "is_online": fila.is_online,
                "last_seen_at": fila.last_seen_at,
                "last_section": fila.last_section,
            }
            for fila in presence.roster()
        ]
        filas.sort(key=lambda fila: (not fila["is_online"], fila["user"].full_name))
        return Response(UserPresenceSerializer(filas, many=True).data)


class UserViewSet(viewsets.ModelViewSet):
    """Alta, baja y edición de empleados. Solo gerencia.

    La baja es lógica: ``DELETE`` desactiva al usuario sin borrar historial.
    """

    queryset = User.objects.all().order_by("full_name")
    required_permissions = {"*": [PermissionCode.USER_MANAGE]}
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "full_name", "employee_number"]
    ordering_fields = ["full_name", "created_at", "role"]

    def get_queryset(self):
        if self.request.query_params.get("include_inactive") == "true":
            return User.all_objects.filter(motel_id=current_motel_id()).order_by("full_name")
        return super().get_queryset()

    def perform_create(self, serializer) -> None:
        serializer.save(motel_id=current_motel_id())

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UserWriteSerializer
        return UserSerializer

    def perform_destroy(self, instance: User) -> None:
        if instance == self.request.user:
            from common.exceptions import DomainError

            raise DomainError("No puedes darte de baja a ti mismo.", code="self_deactivation")
        instance.soft_delete(user=self.request.user, reason="Baja desde administración")

    @extend_schema(responses=UserSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None) -> Response:
        user = get_object_or_404(
            User.all_objects,
            pk=pk,
            motel_id=request.user.motel_id,
        )
        user.restore()
        return Response(UserSerializer(user).data)

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Se forzara el cambio en el próximo acceso")},
    )
    @action(detail=True, methods=["post"], url_path="force-password-change")
    def force_password_change(self, request, pk=None) -> Response:
        user = self.get_object()
        user.must_change_password = True
        user.save(update_fields=["must_change_password", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
