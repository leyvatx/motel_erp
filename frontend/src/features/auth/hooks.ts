import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { authApi, type LoginPayload, type SignupPayload } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryClient'
import { cerrarSesionLocal } from '@/lib/session'
import { despertarServidor } from '@/lib/wakeup'
import { defaultRouteFor, useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import type { LoginResponse, User } from '@/types/api'

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()

  return useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: ({ motel, ...credentials }) => {
      const slug = motel?.trim() || useAuthStore.getState().motelSlug || ''
      return authApi.login(slug ? { ...credentials, motel: slug } : credentials)
    },
    onSuccess: (data) => {
      setSession(data)
      navigate(defaultRouteFor(data.user), { replace: true })
    },
  })
}

/** Alta de autoservicio. Termina como un login: con la sesión puesta y dentro.
 *
 *  Se reabre el asistente de configuración antes de navegar. Está guardado por
 *  navegador, no por cuenta, así que quien ya lo cerró una vez -- probando el
 *  sistema, o registrando un segundo negocio desde la misma máquina -- entraría
 *  a un tablero vacío sin nada que le diga por dónde empezar. */
export function useSignup() {
  const setSession = useAuthStore((state) => state.setSession)
  const reopenSetup = useUiStore((state) => state.reopenSetup)
  const navigate = useNavigate()

  return useMutation<LoginResponse, unknown, SignupPayload>({
    // Antes de mandar el alta se toca la puerta del servidor.
    //
    // Un POST no se puede reintentar a ciegas -- crearía dos negocios -- así
    // que el interceptor lo deja pasar sin red de seguridad. Con el servicio
    // dormido eso significaba que quien se registraba recibía un error de red
    // y se quedaba sin cuenta. Despertarlo primero con una petición que sí es
    // segura de repetir convierte esa espera en una pantalla que explica qué
    // está pasando.
    mutationFn: async (payload) => {
      await despertarServidor()
      return authApi.signup(payload)
    },
    onSuccess: (data) => {
      setSession(data)
      reopenSetup()
      navigate(defaultRouteFor(data.user), { replace: true })
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()

  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      const refresh = useAuthStore.getState().refresh
      if (refresh) {
        await authApi.logout(refresh).catch(() => undefined)
      }
    },
    // `onSettled` y no `onSuccess`: si el servidor no contesta -- dormido, sin
    // red -- la sesión se cierra igual en esta terminal. Quedarse dentro porque
    // no se pudo avisar es lo contrario de lo que pidió el usuario.
    onSettled: () => {
      cerrarSesionLocal()
      navigate('/login', { replace: true })
    },
  })
}

export function useCurrentUser() {
  const access = useAuthStore((state) => state.access)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery<User>({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const user = await authApi.me()
      setUser(user)
      return user
    },
    enabled: Boolean(access),
    staleTime: 5 * 60_000,
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword })
}
