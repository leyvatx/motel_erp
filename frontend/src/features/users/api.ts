import { del, get, patch, post } from '@/lib/axios'
import type { RoleOption, UserListParams, UserPayload } from '@/features/users/types'
import type { PaginatedResponse, User } from '@/types/api'

export const usersApi = {
  list: (params: UserListParams): Promise<PaginatedResponse<User>> =>
    get<PaginatedResponse<User>>('/auth/users/', { params }),
  roles: (): Promise<RoleOption[]> => get<RoleOption[]>('/auth/roles/'),
  create: (payload: UserPayload): Promise<User> => post<User, UserPayload>('/auth/users/', payload),
  update: (id: number, payload: UserPayload): Promise<User> =>
    patch<User, UserPayload>(`/auth/users/${id}/`, payload),
  deactivate: (id: number): Promise<void> => del(`/auth/users/${id}/`),
  restore: (id: number): Promise<User> => post<User>(`/auth/users/${id}/restore/`),
  forcePasswordChange: (id: number): Promise<void> =>
    post<void>(`/auth/users/${id}/force-password-change/`),
}
