"""Rutas de autenticación y usuarios: ``/api/v1/auth/``."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.users.views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    RoleListView,
    TeamPresenceView,
    UserViewSet,
    WsTicketView,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("ws-ticket/", WsTicketView.as_view(), name="ws-ticket"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("roles/", RoleListView.as_view(), name="roles"),
    path("team/", TeamPresenceView.as_view(), name="team-presence"),
    path("", include(router.urls)),
]
