import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import {
  inventoryApi,
  type KardexParams,
  type PurchaseParams,
  type StockParams,
} from '@/features/inventory/api'
import type {
  PurchasePayload,
  PurchaseReceiptPayload,
  Supplier,
  StockAdjustmentPayload,
  StockEntryPayload,
  StockTransferPayload,
  StockWastePayload,
} from '@/features/inventory/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'
import type { ListParams } from '@/types/api'

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses,
    queryFn: inventoryApi.warehouses,
    staleTime: 10 * 60_000,
  })
}

export function useProducts(params?: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.products(params),
    queryFn: () => inventoryApi.products(params),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.inventory.categories,
    queryFn: inventoryApi.categories,
    staleTime: 10 * 60_000,
  })
}

export function useSellableProducts(search?: string) {
  return useQuery({
    queryKey: [...queryKeys.inventory.sellable, search ?? ''],
    queryFn: () => inventoryApi.sellable(search),
    staleTime: 60_000,
  })
}

export function useStocks(params?: StockParams) {
  return useQuery({
    queryKey: queryKeys.inventory.stocks(params),
    queryFn: () => inventoryApi.stocks(params),
  })
}

export function useLowStock(enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.lowStock,
    queryFn: inventoryApi.lowStock,
    enabled,
  })
}

export function useExpiringLots(days = 7) {
  return useQuery({
    queryKey: [...queryKeys.inventory.lots(), 'expiring', days],
    queryFn: () => inventoryApi.expiringLots(days),
  })
}

export function useKardex(params?: KardexParams) {
  return useQuery({
    queryKey: queryKeys.inventory.kardex(params),
    queryFn: () => inventoryApi.kardex(params),
  })
}

function useInventoryInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }
}

export function useStockEntry() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockEntryPayload) => inventoryApi.entry(payload),
    onSuccess: (movement) => {
      invalidate()
      toast.success('Entrada registrada', `${movement.product_name}: +${movement.quantity}`)
    },
    onError: (error) => toast.error('No se pudo registrar la entrada', apiErrorMessage(error)),
  })
}

export function useStockWaste() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockWastePayload) => inventoryApi.waste(payload),
    onSuccess: () => {
      invalidate()
      toast.warning('Merma registrada', 'Quedo asentada en el Kardex con su motivo.')
    },
    onError: (error) => toast.error('No se pudo registrar la merma', apiErrorMessage(error)),
  })
}

export function useStockTransfer() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockTransferPayload) => inventoryApi.transfer(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Traspaso realizado')
    },
    onError: (error) => toast.error('No se pudo traspasar', apiErrorMessage(error)),
  })
}

export function useStockAdjustment() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => inventoryApi.adjust(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Ajuste aplicado', 'El diferencial quedó en el Kardex.')
    },
    onError: (error) => toast.error('No se pudo ajustar', apiErrorMessage(error)),
  })
}

export function useSetStockLevels() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: ({
      stockId,
      minStock,
      maxStock,
    }: {
      stockId: number
      minStock: string
      maxStock?: string
    }) => inventoryApi.setLevels(stockId, minStock, maxStock),
    onSuccess: () => {
      invalidate()
      toast.success('Mínimos actualizados')
    },
    onError: (error) => toast.error('No se pudo guardar', apiErrorMessage(error)),
  })
}

export function useSuppliers(params?: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.suppliers(params),
    queryFn: () => inventoryApi.suppliers(params),
  })
}

export function usePurchases(params?: PurchaseParams) {
  return useQuery({
    queryKey: queryKeys.inventory.purchases(params),
    queryFn: () => inventoryApi.purchases(params),
  })
}

export function useCreateSupplier() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: (payload: Omit<Supplier, 'id' | 'created_at' | 'is_active'>) =>
      inventoryApi.createSupplier(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Proveedor creado')
    },
    onError: (error) => toast.error('No se pudo crear el proveedor', apiErrorMessage(error)),
  })
}

export function useCreatePurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: (payload: PurchasePayload) => inventoryApi.createPurchase(payload),
    onSuccess: (purchase) => {
      invalidate()
      toast.success('Compra creada', purchase.folio)
    },
    onError: (error) => toast.error('No se pudo crear la compra', apiErrorMessage(error)),
  })
}

export function useSubmitPurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: inventoryApi.submitPurchase,
    onSuccess: () => {
      invalidate()
      toast.success('Orden enviada al proveedor')
    },
    onError: (error) => toast.error('No se pudo enviar la orden', apiErrorMessage(error)),
  })
}

export function useReceivePurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PurchaseReceiptPayload }) =>
      inventoryApi.receivePurchase(id, payload),
    onSuccess: (purchase) => {
      invalidate()
      toast.success('Mercancía recibida', `${purchase.folio} actualizó el inventario.`)
    },
    onError: (error) => toast.error('No se pudo recibir la mercancía', apiErrorMessage(error)),
  })
}

export function useCancelPurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: inventoryApi.cancelPurchase,
    onSuccess: () => {
      invalidate()
      toast.warning('Compra cancelada')
    },
    onError: (error) => toast.error('No se pudo cancelar', apiErrorMessage(error)),
  })
}

function useCatalogCreate(
  mutationFn: (payload: Record<string, unknown>) => Promise<unknown>,
  successMessage: string,
) {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidate()
      toast.success(successMessage)
    },
    onError: (error) => toast.error('No se pudo guardar', apiErrorMessage(error)),
  })
}

export function useCreateProduct() {
  return useCatalogCreate(inventoryApi.createProduct, 'Producto creado')
}

export function useCreateCategory() {
  return useCatalogCreate(inventoryApi.createCategory, 'Categoría creada')
}

export function useCreateWarehouse() {
  return useCatalogCreate(inventoryApi.createWarehouse, 'Almacén creado')
}
