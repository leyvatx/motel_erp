import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { toast } from '@/components/ui/toast'
import { useWarehouses } from '@/features/inventory/hooks'
import { salesApi } from '@/features/sales/api'
import type { Warehouse } from '@/features/inventory/types'
import { apiErrorMessage } from '@/lib/axios'
import { formatMoney } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { playSuccessTone } from '@/lib/sound'

export function useFolio(folioId: number | null) {
  return useQuery({
    queryKey: queryKeys.sales.folio(folioId ?? 0),
    queryFn: () => salesApi.folio(folioId as number),
    enabled: folioId !== null,
  })
}

export function useSalesWarehouse(): Warehouse | undefined {
  const { data } = useWarehouses()

  return useMemo(() => {
    const all = data?.results ?? []
    return all.find((warehouse) => warehouse.is_default_for_sales) ?? all[0]
  }, [data])
}

interface RoomOrderArgs {
  folioId: number | null
  roomNumber: string
  /** La renta a la que pertenece la cuenta, para refrescar su saldo. */
  stayId?: number | null
}

export function useChargeToRoom({ folioId, roomNumber, stayId }: RoomOrderArgs) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const warehouse = useSalesWarehouse()

  return useMutation({
    mutationFn: (items: { product_id: number; quantity: string }[]) => {
      if (!warehouse) throw new Error('No hay almacén de venta configurado.')
      if (!folioId) throw new Error('La habitación no tiene cuenta abierta.')

      return salesApi.createOrder({
        folio_id: folioId,
        warehouse_id: warehouse.id,
        order_type: 'ROOM_SERVICE',
        notes: `Pedido de la habitación ${roomNumber}`,
        items,
      })
    },
    onSuccess: (order) => {
      playSuccessTone()
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.grid })
      if (folioId) void queryClient.invalidateQueries({ queryKey: queryKeys.sales.folio(folioId) })
      // Sin esto el diálogo de la renta seguía mostrando el saldo de antes del
      // consumo, y el importe a cobrar salía corto: el huésped se iba debiendo
      // justo lo que se le acababa de cargar.
      if (stayId) void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.stay(stayId) })
      toast.success(
        `Cargado a la habitación ${roomNumber}`,
        `Consumo ${order.code} por ${formatMoney(order.total)}. Se cobra al salir.`,
      )
    },
    onError: (error) => toast.error(t('venta.noSePudoCargarConsumo'), apiErrorMessage(error)),
  })
}
