import { get, post } from '@/lib/axios'
import type { LoginResponse, User } from '@/types/api'

export interface LoginPayload {
  username: string
  password: string
  motel?: string
}

export interface SignupPayload {
  business_name: string
  admin_full_name: string
  email: string
  /** La clave con la que va a entrar. Antes se derivaba del correo en el
   *  servidor y quien se registraba la descubría después. */
  username: string
  phone: string
  /** Franja de habitaciones. El asistente la usa para proponer cuántas crear. */
  operation_size: '1-10' | '11-30' | '31-50' | '50+'
  password: string
  /** Identifica el intento de alta, no la petición: el reintento repite clave
   *  y el servidor devuelve la organización que ya creó. */
  attempt_key?: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export const authApi = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    post<LoginResponse, LoginPayload>('/auth/login/', payload),

  signup: (payload: SignupPayload): Promise<LoginResponse> =>
    post<LoginResponse, SignupPayload>('/settings/registro/', payload),

  logout: (refresh: string): Promise<void> =>
    post<void, { refresh: string }>('/auth/logout/', { refresh }),

  me: (): Promise<User> => get<User>('/auth/me/'),

  changePassword: (payload: ChangePasswordPayload): Promise<void> =>
    post<void, ChangePasswordPayload>('/auth/change-password/', payload),
}
