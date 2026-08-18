from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class MotelJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        raw_motel = request.headers.get("X-Motel-Id", "").strip()
        if not raw_motel:
            return user, token
        try:
            motel_id = int(raw_motel)
        except ValueError as exc:
            raise AuthenticationFailed("El motel seleccionado no es válido.") from exc

        if user.motel_id is not None:
            if user.motel_id != motel_id:
                raise AuthenticationFailed("No tienes acceso al motel seleccionado.")
            user.active_motel_id = user.motel_id
            user.active_access_role = user.role
            return user, token

        if user.is_platform_admin:
            return user, token

        from apps.corporate.services import access_role
        from apps.settings.models import Motel

        role = access_role(user, motel_id)
        motel = Motel.objects.filter(pk=motel_id, is_active=True).first()
        if not role or motel is None:
            raise AuthenticationFailed("No tienes acceso al motel seleccionado.")
        user.active_motel_id = motel_id
        user.active_motel = motel
        user.active_access_role = role
        return user, token
