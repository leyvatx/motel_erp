import type { IsoDateTime, Money, PaymentMethod, RoomStatus, StayStatus } from '@/types/api'

export interface RoomType {
  id: number
  name: string
  code: string
  description: string
  max_occupants: number
  extra_person_price: Money
  sort_order: number
  is_active: boolean
}

export interface TariffBlock {
  id: number
  room_type: number
  room_type_name: string
  name: string
  duration_minutes: number
  base_price: Money
  current_price: Money
  grace_minutes: number
  overstay_hour_price: Money
  is_overnight: boolean
  is_default: boolean
  sort_order: number
  is_active: boolean
}

export interface Room {
  id: number
  number: string
  room_type: number
  room_type_name: string
  status: RoomStatus
  status_display: string
  floor: number
  zone: string
  has_garage: boolean
  notes: string
  status_changed_at: IsoDateTime
  out_of_service_reason: string
  is_active: boolean
}

export interface GridStay {
  id: number
  code: string
  check_in_at: IsoDateTime
  expires_at: IsoDateTime
  remaining_seconds: number
  is_expired: boolean
  occupants: number
  guest_name: string
  vehicle_plate: string
  tariff_block_name: string
  folio_id: number | null
  folio_total: Money | null
  folio_balance: Money | null
}

export interface RoomGridItem {
  id: number
  number: string
  floor: number
  zone: string
  room_type: number
  room_type_name: string
  status: RoomStatus
  status_display: string
  status_changed_at: IsoDateTime
  out_of_service_reason: string
  current_stay: GridStay | null
}

export interface RoomStatusSummary {
  status: RoomStatus
  status_display: string
  count: number
}

export interface StayExtension {
  id: number
  minutes: number
  price: Money
  previous_expires_at: IsoDateTime
  new_expires_at: IsoDateTime
  reason: string
  is_overstay_surcharge: boolean
  created_at: IsoDateTime
}

export interface Stay {
  id: number
  code: string
  room: number
  room_number: string
  room_type: number
  room_type_name: string
  tariff_block: number
  tariff_block_name: string
  reservation: number | null
  status: StayStatus
  status_display: string
  check_in_at: IsoDateTime
  expires_at: IsoDateTime
  checked_out_at: IsoDateTime | null
  remaining_seconds: number
  is_expired: boolean
  base_minutes: number
  extended_minutes: number
  total_minutes: number
  base_price: Money
  extra_person_price: Money
  occupants: number
  guest_name: string
  vehicle_plate: string
  vehicle_description: string
  notes: string
  cancelled_at: IsoDateTime | null
  cancellation_reason: string
  created_at: IsoDateTime
  created_by_name: string | null
  folio_id: number | null
  folio_total: Money | null
  folio_balance: Money | null
  extensions: StayExtension[]
}

export interface StayListItem {
  id: number
  code: string
  room: number
  room_number: string
  status: StayStatus
  check_in_at: IsoDateTime
  expires_at: IsoDateTime
  remaining_seconds: number
  vehicle_plate: string
  guest_name: string
}

export interface Reservation {
  id: number
  code: string
  room: number | null
  room_number: string | null
  room_type: number
  room_type_name: string
  tariff_block: number | null
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED'
  status_display: string
  guest_name: string
  guest_phone: string
  vehicle_plate: string
  occupants: number
  scheduled_start: IsoDateTime
  scheduled_end: IsoDateTime
  deposit_amount: Money
  quoted_price: Money
  notes: string
  cancelled_at: IsoDateTime | null
  cancellation_reason: string
  created_at: IsoDateTime
}

export interface RentRoomPayload {
  room_id: number
  tariff_block_id: number
  occupants: number
  guest_name?: string
  vehicle_plate?: string
  vehicle_description?: string
  notes?: string
  reservation_id?: number | null
}

export interface ExtendStayPayload {
  tariff_block_id?: number | null
  minutes?: number
  price?: string
  reason?: string
}

export interface CheckoutPayment {
  method: PaymentMethod
  amount: string
  tendered_amount?: string
  reference?: string
}

export interface CheckoutPayload {
  payments: CheckoutPayment[]
  apply_overstay: boolean
  discount?: string
  discount_reason?: string
}
