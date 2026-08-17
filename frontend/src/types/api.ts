/**
 * Contratos compartidos con la API.
 *
 * Los importes viajan como string (Decimal en el backend) para no perder
 * centavos en el punto flotante de JavaScript. Se convierten con `toNumber`
 * solo en el momento de mostrarlos o sumarlos en pantalla.
 */

/** Importe monetario serializado por DRF, p. ej. "1250.00". */
export type Money = string

/** Fecha y hora ISO-8601 en UTC tal como la manda el backend. */
export type IsoDateTime = string

export interface PaginatedResponse<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string | Record<string, string[]>
    details: Record<string, unknown>
  }
}

export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

export type Role = 'SUPERADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING'

export interface User {
  id: number
  username: string
  full_name: string
  email: string
  phone: string
  role: Role
  role_display: string
  employee_number: string
  hired_at: string | null
  is_active: boolean
  is_staff: boolean
  must_change_password: boolean
  last_login: IsoDateTime | null
  created_at: IsoDateTime
}

export interface TokenPair {
  access: string
  refresh: string
}

export interface LoginResponse extends TokenPair {
  user: User
}

export type RoomStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'BLOCKED'

export type StayStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'COURTESY'

export type NotificationLevel = 'INFO' | 'WARNING' | 'CRITICAL'
