"""Entrar con la clave de empleado o con el correo, indistintamente."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameBackend(ModelBackend):
    """Acepta las dos formas en que la gente se identifica a sí misma.

    El sistema entra con clave de empleado -- la recepcionista teclea ``rocio``,
    no su correo -- pero quien da de alta el negocio se registró con su correo y
    esa es la única credencial que recuerda. Obligarlo a adivinar cuál de las dos
    quiere el formulario es una llamada a soporte el primer día.

    La búsqueda respeta el motel en curso porque usa el manager por omisión de
    ``User``, que ya viene acotado: dos sucursales pueden tener una ``recepcion``
    cada una y ninguna ve a la otra. Quien resuelve qué motel es antes de llegar
    aquí es el serializador del token.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()

        identificador = username or kwargs.get(UserModel.USERNAME_FIELD) or kwargs.get("email")
        identificador = (identificador or "").strip()

        # Sin identificador no hay a quién buscar, y un correo vacío haría
        # coincidir a todo el que no tiene correo capturado.
        if not identificador or password is None:
            return None

        candidatos = list(
            UserModel.objects.filter(
                Q(username__iexact=identificador) | Q(email__iexact=identificador)
            )[:2]
        )

        if len(candidatos) != 1:
            # Ni uno ni varios. En los dos casos se gasta el mismo tiempo que
            # con un usuario real: comparar contra un hash inexistente es lo que
            # evita que el tiempo de respuesta delate qué correos existen.
            UserModel().set_password(password)
            return None

        usuario = candidatos[0]
        if usuario.check_password(password) and self.user_can_authenticate(usuario):
            return usuario
        return None
