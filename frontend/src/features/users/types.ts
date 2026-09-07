import type { Role } from '@/types/api'

export interface RoleOption {
  value: Role
  label: string
}

export interface PermissionOption {
  code: string
  label: string
  /** Módulo donde se ejerce el permiso. Lo decide el servidor. */
  group: string
}

export interface RoleMatrixRole {
  value: Role
  label: string
  permissions: string[]
}

export interface RoleMatrix {
  roles: RoleMatrixRole[]
  permissions: PermissionOption[]
}

export interface UserSession {
  sid: string
  user: number
  user_username: string
  user_full_name: string
  user_role_display: string
  ip_address: string | null
  user_agent: string
  /** Navegador y sistema ya resumidos por el servidor. */
  device: string
  created_at: string
  last_seen_at: string | null
  expires_at: string | null
  /** La sesión desde la que se está mirando la pantalla. */
  is_current: boolean
}

export interface UserPayload {
  username: string
  full_name: string
  email?: string
  phone?: string
  role: Role
  employee_number?: string
  hired_at?: string | null
  password?: string
  must_change_password: boolean
}

export interface UserListParams {
  page: number
  page_size: number
  search?: string
  role?: Role
  is_active?: boolean
  include_inactive?: boolean
  ordering?: string
}
