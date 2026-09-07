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
  password: string
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
