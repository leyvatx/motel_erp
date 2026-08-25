import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { frontdeskApi, type GridParams } from '@/features/frontdesk/api'
import type { ReservationParams } from '@/features/frontdesk/api'
import type {
  CheckoutPayload,
  ExtendStayPayload,
  RentRoomPayload,
  ReservationPayload,
} from '@/features/frontdesk/types'
import { toast } from '@/components/ui/toast'
import { toastApiError } from '@/features/finances/shiftGuard'
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

export function useRoomSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.frontdesk.summary,
    queryFn: frontdeskApi.summary,
    enabled,
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

export function useExpiringStays(enabled = true) {
  return useQuery({
    queryKey: queryKeys.frontdesk.expiring,
    queryFn: frontdeskApi.expiring,
    enabled,
  })
}

export function useReservations(params?: ReservationParams) {
  return useQuery({
    queryKey: queryKeys.frontdesk.reservations(params),
    queryFn: () => frontdeskApi.reservations(params),
    placeholderData: (previous) => previous,
  })
}

/**
 * Reservación vigente de una habitación. Reservar no cambia el estado del
 * cuarto, así que la cuadrícula no puede deducirla: hay que preguntarla.
 */
export function useRoomReservation(roomId: number | null) {
  const params: ReservationParams = {
    room: roomId ?? 0,
    active: true,
    ordering: 'scheduled_start',
    page_size: 1,
  }

  return useQuery({
    queryKey: queryKeys.frontdesk.reservations(params),
    queryFn: () => frontdeskApi.reservations(params),
    enabled: roomId !== null,
    select: (page) => page.results[0] ?? null,
  })
}

export function useUpcomingReservations(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.frontdesk.reservations(), 'upcoming'],
    queryFn: frontdeskApi.upcomingReservations,
    enabled,
  })
}

function useReservationMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  successMessage: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['frontdesk', 'reservations'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.grid })
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.summary })
      toast.success(successMessage)
    },
    onError: (error) => toast.error('No se pudo completar', apiErrorMessage(error)),
  })
}

export const useCreateReservation = () =>
  useReservationMutation<ReservationPayload, unknown>(
    frontdeskApi.createReservation,
    'Reservación creada',
  )

export const useCancelReservation = () =>
  useReservationMutation<{ id: number; reason: string }, unknown>(
    ({ id, reason }) => frontdeskApi.cancelReservation(id, reason),
    'Reservación cancelada',
  )

export const useCheckInReservation = () =>
  useReservationMutation<{ id: number; roomId: number; tariffBlockId: number }, unknown>(
    ({ id, roomId, tariffBlockId }) => frontdeskApi.checkInReservation(id, roomId, tariffBlockId),
    'Llegada registrada',
  )

export const useMarkReservationNoShow = () =>
  useReservationMutation<number, unknown>(
    frontdeskApi.markReservationNoShow,
    'Reservación marcada como no-show',
  )

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
      toast.success(`Cuenta cerrada - habitación ${stay.room_number}`, 'El cuarto paso a limpieza.')
    },
    onError: (error) => toastApiError('No se pudo cerrar la cuenta', error),
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
    mutationFn: ({
      roomId,
      reason,
      blocked,
    }: {
      roomId: number
      reason: string
      blocked?: boolean
    }) => frontdeskApi.outOfService(roomId, reason, blocked ?? false),
    onSuccess: (room) => {
      invalidate()
      toast.warning(`Habitación ${room.number} fuera de servicio`)
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', apiErrorMessage(error)),
  })
}
