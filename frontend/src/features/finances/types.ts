import type { IsoDateTime, Money } from '@/types/api'

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'VERIFIED'
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Shift {
  id: number
  code: string
  cashier: number
  cashier_name: string
  shift_type: string
  shift_type_display: string
  status: ShiftStatus
  status_display: string
  opened_at: IsoDateTime
  closed_at: IsoDateTime | null
  business_date: string
  opening_balance: Money
  cash_sales: Money
  card_sales: Money
  transfer_sales: Money
  courtesy_total: Money
  cash_in_total: Money
  cash_out_total: Money
  expenses_total: Money
  expected_cash: Money
  declared_cash: Money | null
  difference: Money
  total_sales: Money
  folios_closed: number
  stays_closed: number
  closed_by: number | null
  verified_by: number | null
  verified_at: IsoDateTime | null
  notes: string
}

export interface Expense {
  id: number
  folio: string
  shift: number
  category: string
  category_display: string
  description: string
  supplier: string
  amount: Money
  status: ExpenseStatus
  status_display: string
  requires_approval: boolean
  receipt_reference: string
  requested_by: number
  requested_by_name: string
  reviewed_by: number | null
  reviewed_by_name: string | null
  reviewed_at: IsoDateTime | null
  review_notes: string
  created_at: IsoDateTime
}

export interface CashMovement {
  id: number
  shift: number
  direction: 'IN' | 'OUT'
  direction_display: string
  reason: string
  reason_display: string
  amount: Money
  description: string
  reference: string
  expense: number | null
  performed_by: number
  performed_by_name: string
  created_at: IsoDateTime
}

export type CashBreakdown = Record<string, number>

export interface OpenShiftPayload {
  opening_balance: string
  shift_type?: string
  breakdown?: CashBreakdown
  notes?: string
}

export interface CloseShiftPayload {
  declared_cash: string
  breakdown?: CashBreakdown
  notes?: string
}

export interface ExpensePayload {
  amount: string
  description: string
  category?: string
  supplier?: string
  receipt_reference?: string
}

export interface ShiftTrendHour {
  hour: string
  label: string
  sales: string
  rentals: number
}

export interface ShiftTrend {
  shift: string | null
  hours: ShiftTrendHour[]
}
