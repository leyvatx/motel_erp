import { get, post } from '@/lib/axios'
import type { ListParams, PaginatedResponse } from '@/types/api'
import type {
  Product,
  ProductCategory,
  StockAdjustmentPayload,
  StockEntryPayload,
  StockLot,
  StockMovement,
  StockTransferPayload,
  StockWastePayload,
  Warehouse,
  WarehouseStock,
  Supplier,
  PurchaseOrder,
  PurchasePayload,
  PurchaseReceiptPayload,
} from '@/features/inventory/types'

export interface StockParams extends ListParams {
  warehouse?: number
  product?: number
}

export interface KardexParams extends ListParams {
  product?: number
  warehouse?: number
  movement_type?: string
}

export interface PurchaseParams extends ListParams {
  status?: string
  supplier?: number
  warehouse?: number
}

export const inventoryApi = {
  warehouses: (): Promise<PaginatedResponse<Warehouse>> =>
    get<PaginatedResponse<Warehouse>>('/inventory/warehouses/', { params: { page_size: 100 } }),

  categories: (): Promise<PaginatedResponse<ProductCategory>> =>
    get<PaginatedResponse<ProductCategory>>('/inventory/categories/', {
      params: { page_size: 100 },
    }),

  products: (params?: ListParams): Promise<PaginatedResponse<Product>> =>
    get<PaginatedResponse<Product>>('/inventory/products/', { params }),

  createProduct: (payload: Record<string, unknown>): Promise<Product> =>
    post<Product, Record<string, unknown>>('/inventory/products/', payload),

  createCategory: (payload: Record<string, unknown>): Promise<ProductCategory> =>
    post<ProductCategory, Record<string, unknown>>('/inventory/categories/', payload),

  createWarehouse: (payload: Record<string, unknown>): Promise<Warehouse> =>
    post<Warehouse, Record<string, unknown>>('/inventory/warehouses/', payload),

  sellable: (search?: string): Promise<PaginatedResponse<Product>> =>
    get<PaginatedResponse<Product>>('/inventory/products/sellable/', {
      params: { search, page_size: 100 },
    }),

  stocks: (params?: StockParams): Promise<PaginatedResponse<WarehouseStock>> =>
    get<PaginatedResponse<WarehouseStock>>('/inventory/stocks/', { params }),

  lowStock: (): Promise<PaginatedResponse<WarehouseStock>> =>
    get<PaginatedResponse<WarehouseStock>>('/inventory/stocks/low-stock/'),

  setLevels: (stockId: number, minStock: string, maxStock?: string): Promise<WarehouseStock> =>
    post<WarehouseStock, { min_stock: string; max_stock?: string }>(
      `/inventory/stocks/${stockId}/levels/`,
      { min_stock: minStock, ...(maxStock ? { max_stock: maxStock } : {}) },
    ),

  lots: (params?: ListParams): Promise<PaginatedResponse<StockLot>> =>
    get<PaginatedResponse<StockLot>>('/inventory/lots/', { params }),

  expiringLots: (days = 7): Promise<PaginatedResponse<StockLot>> =>
    get<PaginatedResponse<StockLot>>('/inventory/lots/expiring/', { params: { days } }),

  kardex: (params?: KardexParams): Promise<PaginatedResponse<StockMovement>> =>
    get<PaginatedResponse<StockMovement>>('/inventory/kardex/', { params }),

  entry: (payload: StockEntryPayload): Promise<StockMovement> =>
    post<StockMovement, StockEntryPayload>('/inventory/kardex/entry/', payload),

  waste: (payload: StockWastePayload): Promise<StockMovement[]> =>
    post<StockMovement[], StockWastePayload>('/inventory/kardex/waste/', payload),

  transfer: (payload: StockTransferPayload): Promise<StockMovement[]> =>
    post<StockMovement[], StockTransferPayload>('/inventory/kardex/transfer/', payload),

  adjust: (payload: StockAdjustmentPayload): Promise<StockMovement> =>
    post<StockMovement, StockAdjustmentPayload>('/inventory/kardex/adjust/', payload),

  suppliers: (params?: ListParams): Promise<PaginatedResponse<Supplier>> =>
    get<PaginatedResponse<Supplier>>('/inventory/suppliers/', { params }),

  createSupplier: (payload: Omit<Supplier, 'id' | 'created_at' | 'is_active'>): Promise<Supplier> =>
    post<Supplier, typeof payload>('/inventory/suppliers/', payload),

  purchases: (params?: PurchaseParams): Promise<PaginatedResponse<PurchaseOrder>> =>
    get<PaginatedResponse<PurchaseOrder>>('/inventory/purchases/', { params }),

  createPurchase: (payload: PurchasePayload): Promise<PurchaseOrder> =>
    post<PurchaseOrder, PurchasePayload>('/inventory/purchases/', payload),

  submitPurchase: (id: number): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/inventory/purchases/${id}/submit/`),

  receivePurchase: (id: number, payload: PurchaseReceiptPayload): Promise<PurchaseOrder> =>
    post<PurchaseOrder, PurchaseReceiptPayload>(`/inventory/purchases/${id}/receive/`, payload),

  cancelPurchase: (id: number): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/inventory/purchases/${id}/cancel/`),
}
