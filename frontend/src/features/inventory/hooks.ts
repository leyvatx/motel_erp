import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import { inventoryApi, type KardexParams, type StockParams } from '@/features/inventory/api'
import type {
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

export function useLowStock() {
  return useQuery({
    queryKey: queryKeys.inventory.lowStock,
    queryFn: inventoryApi.lowStock,
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
    mutationFn: ({ stockId, minStock, maxStock }: { stockId: number; minStock: string; maxStock?: string }) =>
      inventoryApi.setLevels(stockId, minStock, maxStock),
    onSuccess: () => {
      invalidate()
      toast.success('Mínimos actualizados')
    },
    onError: (error) => toast.error('No se pudo guardar', apiErrorMessage(error)),
  })
}
