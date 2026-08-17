import type { IsoDateTime, Money, PaymentMethod } from '@/types/api'

export type FolioStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'

export interface FolioCharge {
  id: number
  charge_type: string
  charge_type_display: string
  description: string
  quantity: string
  unit_price: Money
  tax_amount: Money
  amount: Money
  order: number | null
  stay_extension: number | null
  is_active: boolean
  cancelled_at: IsoDateTime | null
  cancellation_reason: string
  created_at: IsoDateTime
}

export interface Payment {
  id: number
  folio: number
  method: PaymentMethod
  method_display: string
  status: 'APPLIED' | 'VOIDED'
  amount: Money
  tendered_amount: Money
  change_amount: Money
  reference: string
  received_by: number
  received_by_name: string
  paid_at: IsoDateTime
  voided_at: IsoDateTime | null
  void_reason: string
}

export interface OrderItem {
  id: number
  product: number
  product_sku: string
  description: string
  quantity: string
  unit_price: Money
  discount_amount: Money
  tax_rate: string
  tax_amount: Money
  line_total: Money
  is_active: boolean
  cancelled_at: IsoDateTime | null
  cancellation_reason: string
}

export interface Order {
  id: number
  code: string
  folio: number
  order_type: string
  order_type_display: string
  status: string
  status_display: string
  warehouse: number
  warehouse_name: string
  placed_at: IsoDateTime
  delivered_at: IsoDateTime | null
  delivered_by: number | null
  subtotal: Money
  tax_total: Money
  total: Money
  notes: string
  cancelled_at: IsoDateTime | null
  cancellation_reason: string
  items: OrderItem[]
}

export interface Folio {
  id: number
  code: string
  folio_type: 'ROOM' | 'COUNTER'
  status: FolioStatus
  status_display: string
  stay: number | null
  stay_code: string | null
  room: number | null
  room_number: string | null
  opened_at: IsoDateTime
  closed_at: IsoDateTime | null
  subtotal: Money
  discount_total: Money
  tax_total: Money
  total: Money
  paid_total: Money
  balance: Money
  notes: string
  charges: FolioCharge[]
  payments: Payment[]
  orders: Order[]
}

export interface CreateOrderPayload {
  folio_id: number
  warehouse_id: number
  order_type?: 'ROOM_SERVICE' | 'MINIBAR' | 'SHOP' | 'COUNTER'
  notes?: string
  items: { product_id: number; quantity: string; unit_price?: string }[]
}

export interface PaymentPayload {
  method: PaymentMethod
  amount: string
  tendered_amount?: string
  reference?: string
}

export interface TicketPreview {
  receipt_id: number
  is_reprint: boolean
  preview: string
}
