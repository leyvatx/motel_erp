import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
}

export function useChargeToRoom({ folioId, roomNumber }: RoomOrderArgs) {
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
      toast.success(
        `Cargado a la habitación ${roomNumber}`,
        `Consumo ${order.code} por ${formatMoney(order.total)}. Se cobra al salir.`,
      )
    },
    onError: (error) => toast.error('No se pudo cargar el consumo', apiErrorMessage(error)),
  })
}
