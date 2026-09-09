import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18n from '@/lib/i18n'

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
      toast.success(
        i18n.t('inventario.entradaRegistrada'),
        `${movement.product_name}: +${movement.quantity}`,
      )
    },
    onError: (error) =>
      toast.error(i18n.t('inventario.noSePudoRegistrarEntrada'), apiErrorMessage(error)),
  })
}

export function useStockWaste() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockWastePayload) => inventoryApi.waste(payload),
    onSuccess: () => {
      invalidate()
      toast.warning(i18n.t('inventario.mermaRegistrada'), i18n.t('inventario.quedoAsentada'))
    },
    onError: (error) =>
      toast.error(i18n.t('inventario.noSePudoRegistrarMerma'), apiErrorMessage(error)),
  })
}

export function useStockTransfer() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockTransferPayload) => inventoryApi.transfer(payload),
    onSuccess: () => {
      invalidate()
      toast.success(i18n.t('inventario.traspasoRealizado'))
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoTraspasar'), apiErrorMessage(error)),
  })
}

export function useStockAdjustment() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => inventoryApi.adjust(payload),
    onSuccess: () => {
      invalidate()
      toast.success(i18n.t('inventario.ajusteAplicado'), i18n.t('inventario.diferencialKardex'))
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoAjustar'), apiErrorMessage(error)),
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
      toast.success(i18n.t('inventario.minimosActualizados'))
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoGuardar'), apiErrorMessage(error)),
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
      toast.success(i18n.t('inventario.proveedorCreado'))
    },
    onError: (error) =>
      toast.error(i18n.t('inventario.noSePudoCrearProveedor'), apiErrorMessage(error)),
  })
}

export function useCreatePurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: (payload: PurchasePayload) => inventoryApi.createPurchase(payload),
    onSuccess: (purchase) => {
      invalidate()
      toast.success(i18n.t('inventario.compraCreada'), purchase.folio)
    },
    onError: (error) =>
      toast.error(i18n.t('inventario.noSePudoCrearCompra'), apiErrorMessage(error)),
  })
}

export function useSubmitPurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: inventoryApi.submitPurchase,
    onSuccess: () => {
      invalidate()
      toast.success(i18n.t('inventario.ordenEnviada'))
    },
    onError: (error) =>
      toast.error(i18n.t('inventario.noSePudoEnviarOrden'), apiErrorMessage(error)),
  })
}

export function useReceivePurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PurchaseReceiptPayload }) =>
      inventoryApi.receivePurchase(id, payload),
    onSuccess: (purchase) => {
      invalidate()
      toast.success(
        i18n.t('inventario.mercanciaRecibida'),
        `${purchase.folio} actualizó el inventario.`,
      )
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoRecibir'), apiErrorMessage(error)),
  })
}

export function useCancelPurchase() {
  const invalidate = useInventoryInvalidation()
  return useMutation({
    mutationFn: inventoryApi.cancelPurchase,
    onSuccess: () => {
      invalidate()
      toast.warning(i18n.t('inventario.compraCancelada'))
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoCancelar'), apiErrorMessage(error)),
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
    onError: (error) => toast.error(i18n.t('inventario.noSePudoGuardar'), apiErrorMessage(error)),
  })
}

/** Alta de producto: el catálogo es la única fuente de verdad.
 *
 *  Lo crea tanto Inventarios como la caja, y las dos invalidan lo mismo, así
 *  que un producto dado de alta mientras se cobra aparece de inmediato en el
 *  catálogo del punto de venta sin recargar nada. */
export function useCreateProduct() {
  const invalidate = useInventoryInvalidation()

  return useMutation({
    mutationFn: ({ payload, image }: { payload: Record<string, unknown>; image?: File | null }) =>
      inventoryApi.createProduct(payload, image),
    onSuccess: () => {
      invalidate()
      toast.success(i18n.t('inventario.productoCreado'))
    },
    onError: (error) => toast.error(i18n.t('inventario.noSePudoGuardar'), apiErrorMessage(error)),
  })
}

export function useCreateCategory() {
  return useCatalogCreate(inventoryApi.createCategory, i18n.t('inventario.categoriaCreada'))
}

export function useCreateWarehouse() {
  return useCatalogCreate(inventoryApi.createWarehouse, i18n.t('inventario.almacenCreado'))
}
