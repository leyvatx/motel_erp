/** Eventos que el backend publica por WebSocket. */

import type { IsoDateTime, Money, RoomStatus, StayStatus } from '@/types/api'

export const RealtimeEvent = {
  ConnectionReady: 'connection.ready',
  RoomStatusChanged: 'room.status_changed',
  StayStarted: 'stay.started',
  StayExtended: 'stay.extended',
  StayClosed: 'stay.closed',
  StayCancelled: 'stay.cancelled',
  StayExpiring: 'stay.expiring',
  StayExpired: 'stay.expired',
  OrderCreated: 'order.created',
  OrderDelivered: 'order.delivered',
  OrderCancelled: 'order.cancelled',
  CleaningTask: 'housekeeping.task',
  MaintenanceReported: 'maintenance.reported',
  StockLow: 'inventory.low_stock',
  StockExpiring: 'inventory.expiring_lot',
  NotificationNew: 'notification.new',
  ShiftChanged: 'finances.shift_changed',
  PresenceChanged: 'presence.changed',
} as const

export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent]

export interface StayEventPayload {
  stay_id: number
  code: string
  room_id: number
  room_number: string | null
  status: StayStatus
  check_in_at: IsoDateTime
  expires_at: IsoDateTime
  remaining_seconds: number
  vehicle_plate: string
  guest_name: string
  added_minutes?: number
  reason?: string
}

export interface RoomEventPayload {
  room_id: number
  number: string
  status: RoomStatus
  status_changed_at: IsoDateTime | null
  room_type_id: number
  stay: StayEventPayload | null
  from_status?: RoomStatus
  to_status?: RoomStatus
}

export interface OrderEventPayload {
  order_id: number
  code: string
  folio_id: number
  room_number: string | null
  order_type: string
  status: string
  total: Money
  items: number
}

export interface NotificationEventPayload {
  id: number
  category: string
  level: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  body: string
  payload: Record<string, unknown>
  created_at: IsoDateTime
}

export interface LowStockEventPayload {
  product_id: number
  sku: string
  product: string
  warehouse_id: number
  warehouse: string
  quantity: string
  min_stock: string
}

/** Sobre común de todo mensaje entrante. */
export interface RealtimeMessage<TPayload = unknown> {
  event: RealtimeEventName | string
  payload: TPayload
  timestamp?: IsoDateTime
}

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'
