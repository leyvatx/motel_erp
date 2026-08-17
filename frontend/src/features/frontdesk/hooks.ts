import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { frontdeskApi, type GridParams } from '@/features/frontdesk/api'
import type {
  CheckoutPayload,
  ExtendStayPayload,
  RentRoomPayload,
} from '@/features/frontdesk/types'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'
import { playSuccessTone } from '@/lib/sound'

export function useRoomGrid(params?: GridParams) {
  return useQuery({
    queryKey: [...queryKeys.frontdesk.grid, params ?? {}],
    queryFn: () => frontdeskApi.grid(params),
    refetchInterval: 90_000,
  })
}

export function useRoomSummary() {
  return useQuery({
    queryKey: queryKeys.frontdesk.summary,
    queryFn: frontdeskApi.summary,
  })
}

export function useRoomTypes() {
  return useQuery({
    queryKey: queryKeys.frontdesk.roomTypes,
    queryFn: frontdeskApi.roomTypes,
    staleTime: 10 * 60_000,
  })
}

export function useTariffBlocks(roomType?: number) {
  return useQuery({
    queryKey: queryKeys.frontdesk.tariffBlocks(roomType),
    queryFn: () => frontdeskApi.tariffBlocks(roomType),
    enabled: roomType !== undefined,
    staleTime: 5 * 60_000,
  })
}

export function useStay(stayId: number | null) {
  return useQuery({
    queryKey: queryKeys.frontdesk.stay(stayId ?? 0),
    queryFn: () => frontdeskApi.stay(stayId as number),
    enabled: stayId !== null,
  })
}

export function useExpiringStays() {
  return useQuery({
    queryKey: queryKeys.frontdesk.expiring,
    queryFn: frontdeskApi.expiring,
  })
}

function useFrontdeskInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.grid })
    void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.summary })
    void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.expiring })
  }
}

export function useRentRoom() {
  const invalidate = useFrontdeskInvalidation()

  return useMutation({
    mutationFn: (payload: RentRoomPayload) => frontdeskApi.rent(payload),
    onSuccess: (stay) => {
      invalidate()
      playSuccessTone()
      toast.success(`Habitación ${stay.room_number} rentada`, `Folio ${stay.code}`)
    },
    onError: (error) => toast.error('No se pudo rentar', apiErrorMessage(error)),
  })
}

export function useExtendStay(stayId: number) {
  const invalidate = useFrontdeskInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ExtendStayPayload) => frontdeskApi.extend(stayId, payload),
    onSuccess: (stay) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.stay(stayId) })
      toast.success('Tiempo extendido', `Habitación ${stay.room_number}`)
    },
    onError: (error) => toast.error('No se pudo extender', apiErrorMessage(error)),
  })
}

export function useCheckoutStay(stayId: number) {
  const invalidate = useFrontdeskInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CheckoutPayload) => frontdeskApi.checkout(stayId, payload),
    onSuccess: (stay) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.stay(stayId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.finances.currentShift })
      playSuccessTone()
      toast.success(
        `Cuenta cerrada - habitación ${stay.room_number}`,
        'El cuarto paso a limpieza.',
      )
    },
    onError: (error) => toast.error('No se pudo cerrar la cuenta', apiErrorMessage(error)),
  })
}

export function useCancelStay(stayId: number) {
  const invalidate = useFrontdeskInvalidation()

  return useMutation({
    mutationFn: (reason: string) => frontdeskApi.cancelStay(stayId, reason),
    onSuccess: () => {
      invalidate()
      toast.warning('Renta cancelada', 'El movimiento quedó en la bitácora.')
    },
    onError: (error) => toast.error('No se pudo cancelar', apiErrorMessage(error)),
  })
}

export function useFinishCleaning() {
  const invalidate = useFrontdeskInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (roomId: number) => frontdeskApi.finishCleaning(roomId),
    onSuccess: (room) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.housekeeping.board() })
      toast.success(`Habitación ${room.number} disponible`)
    },
    onError: (error) => toast.error('No se pudo liberar el cuarto', apiErrorMessage(error)),
  })
}

export function useSetOutOfService() {
  const invalidate = useFrontdeskInvalidation()

  return useMutation({
    mutationFn: ({ roomId, reason, blocked }: { roomId: number; reason: string; blocked?: boolean }) =>
      frontdeskApi.outOfService(roomId, reason, blocked ?? false),
    onSuccess: (room) => {
      invalidate()
      toast.warning(`Habitación ${room.number} fuera de servicio`)
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', apiErrorMessage(error)),
  })
}
