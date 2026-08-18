import type { IsoDateTime, Money } from '@/types/api'

export type MovementType =
  | 'PURCHASE'
  | 'RETURN_IN'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_IN'
  | 'INITIAL'
  | 'SALE'
  | 'CONSUMPTION'
  | 'WASTE'
  | 'EXPIRED'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_OUT'

export interface Warehouse {
  id: number
  code: string
  name: string
  warehouse_type: string
  warehouse_type_display: string
  location: string
  is_default_for_sales: boolean
  responsible: number | null
  is_active: boolean
}

export interface ProductCategory {
  id: number
  name: string
  kind: string
  kind_display: string
  description: string
  sort_order: number
  is_active: boolean
}

export interface Product {
  id: number
  sku: string
  barcode: string
  name: string
  category: number
  category_name: string
  unit: string
  unit_display: string
  is_sellable: boolean
  is_stockable: boolean
  track_expiration: boolean
  sale_price: Money
  last_cost: Money
  average_cost: Money
  tax_rate: string
  default_min_stock: string
  total_stock: string | null
  is_active: boolean
}

export interface WarehouseStock {
  id: number
  product: number
  product_sku: string
  product_name: string
  warehouse: number
  warehouse_name: string
  quantity: string
  reserved_quantity: string
  available_quantity: string
  min_stock: string
  max_stock: string
  is_below_minimum: boolean
  updated_at: IsoDateTime
}

export interface StockLot {
  id: number
  product: number
  product_name: string
  warehouse: number
  warehouse_name: string
  lot_code: string
  expiration_date: string | null
  quantity: string
  unit_cost: Money
  received_at: IsoDateTime
  is_expired: boolean
  is_active: boolean
}

export interface StockMovement {
  id: number
  product: number
  product_sku: string
  product_name: string
  warehouse: number
  warehouse_name: string
  lot: number | null
  movement_type: MovementType
  movement_type_display: string
  quantity: string
  signed_quantity: string
  balance_after: string
  unit_cost: Money
  total_cost: Money
  reason: string
  performed_by: number | null
  performed_by_name: string | null
  reversal_of: number | null
  created_at: IsoDateTime
}

export interface StockEntryPayload {
  product_id: number
  warehouse_id: number
  quantity: string
  unit_cost?: string
  movement_type?: 'PURCHASE' | 'RETURN_IN' | 'INITIAL'
  lot_code?: string
  expiration_date?: string | null
  reason?: string
}

export interface StockWastePayload {
  product_id: number
  warehouse_id: number
  lot_id?: number | null
  quantity: string
  expired: boolean
  reason: string
}

export interface StockTransferPayload {
  product_id: number
  source_warehouse_id: number
  target_warehouse_id: number
  quantity: string
  reason?: string
}

export interface StockAdjustmentPayload {
  product_id: number
  warehouse_id: number
  counted_quantity: string
  reason: string
}

export interface Supplier {
  id: number
  code: string
  business_name: string
  tax_id: string
  contact_name: string
  phone: string
  email: string
  address: string
  payment_terms_days: number
  notes: string
  is_active: boolean
  created_at: IsoDateTime
}

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseItem {
  id: number
  product: number
  product_name: string
  product_sku: string
  quantity: string
  received_quantity: string
  pending_quantity: string
  unit_cost: Money
  tax_rate: string
  line_subtotal: Money
  line_total: Money
}

export interface PurchaseOrder {
  id: number
  folio: string
  supplier: number
  supplier_name: string
  warehouse: number
  warehouse_name: string
  status: PurchaseStatus
  status_display: string
  order_date: string
  expected_date: string | null
  supplier_reference: string
  notes: string
  subtotal: Money
  tax_total: Money
  total: Money
  received_at: IsoDateTime | null
  created_by_name: string | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
  items: PurchaseItem[]
}

export interface PurchasePayload {
  supplier: number
  warehouse: number
  order_date: string
  expected_date?: string | null
  supplier_reference?: string
  notes?: string
  items: Array<{ product: number; quantity: string; unit_cost: string; tax_rate: string }>
}

export interface PurchaseReceiptPayload {
  items: Array<{
    item_id: number
    quantity: string
    lot_code?: string
    expiration_date?: string | null
  }>
}
