"""Autenticación por JWT, acotada al motel de la petición y a su sesión."""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class MotelJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        self._exigir_sesion_viva(token)
        raw_motel = request.headers.get("X-Motel-Id", "").strip()
        if not raw_motel:
            return user, token
        try:
            motel_id = int(raw_motel)
        except ValueError as exc:
            raise AuthenticationFailed("La sucursal seleccionada no es válida.") from exc

        if user.motel_id is not None:
            if user.motel_id != motel_id:
                raise AuthenticationFailed("No tienes acceso a la sucursal seleccionada.")
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
            raise AuthenticationFailed("No tienes acceso a la sucursal seleccionada.")
        user.active_motel_id = motel_id
        user.active_motel = motel
        user.active_access_role = role
        return user, token

    @staticmethod
    def _exigir_sesion_viva(token) -> None:
        """Rechaza el token cuyo dueño perdió la sesión.

        Sin esto, revocar solo mata el refresh y el access token que ya tiene el
        navegador sigue sirviendo hasta media hora. La comprobación va contra
        Redis, no contra la base: ver ``apps.users.sessions``.

        Un token sin ``sid`` es de antes de que existieran las sesiones y se
        deja pasar. No se puede revocar de forma individual, pero muere al
        vencer su refresh, y dar de baja al usuario lo corta igual.
        """
        # Adentro y no arriba: este módulo lo carga DRF al leer sus ajustes,
        # antes de que las apps terminen de registrarse.
        from apps.users import sessions

        sid = token.get(sessions.CLAVE_SESION)
        if sid is None:
            return
        if sessions.esta_revocada(sid):
            raise AuthenticationFailed("Tu sesión se cerró desde otro equipo.")
        sessions.latir(sid)
