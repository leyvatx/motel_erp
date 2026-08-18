import type { Role } from '@/types/api'

export interface RoleOption {
  value: Role
  label: string
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
