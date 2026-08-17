import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import { configApi } from '@/features/config/api'
import { frontdeskApi } from '@/features/frontdesk/api'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'

/** Catálogo de habitaciones paginado desde el servidor. */
export function useAllRooms(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.frontdesk.rooms({ page, pageSize }),
    queryFn: () => frontdeskApi.rooms({ page, page_size: pageSize, ordering: 'number' }),
    placeholderData: (previous) => previous,
  })
}

/** Todas las tarifas, sin filtrar por tipo de habitación. */
export function useAllTariffBlocks() {
  return useQuery({
    queryKey: ['frontdesk', 'tariff-blocks', 'all'] as const,
    queryFn: () => frontdeskApi.tariffBlocks(),
  })
}

function useConfigInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['frontdesk'] })
  }
}

function useConfigMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  successMessage: string,
) {
  const invalidate = useConfigInvalidation()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidate()
      toast.success(successMessage)
    },
    onError: (error) => toast.error('No se pudo guardar', apiErrorMessage(error)),
  })
}

export const useCreateRoom = () =>
  useConfigMutation(configApi.createRoom, 'Habitación creada')

export const useUpdateRoom = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateRoom>[1] }) =>
      configApi.updateRoom(id, payload),
    'Habitación actualizada',
  )

export const useDeactivateRoom = () =>
  useConfigMutation(configApi.deactivateRoom, 'Habitación dada de baja')

export const useCreateRoomType = () =>
  useConfigMutation(configApi.createRoomType, 'Tipo de habitación creado')

export const useUpdateRoomType = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateRoomType>[1] }) =>
      configApi.updateRoomType(id, payload),
    'Tipo actualizado',
  )

export const useDeactivateRoomType = () =>
  useConfigMutation(configApi.deactivateRoomType, 'Tipo dado de baja')

export const useCreateTariff = () =>
  useConfigMutation(configApi.createTariff, 'Tarifa creada')

export const useUpdateTariff = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateTariff>[1] }) =>
      configApi.updateTariff(id, payload),
    'Tarifa actualizada',
  )

export const useDeactivateTariff = () =>
  useConfigMutation(configApi.deactivateTariff, 'Tarifa dada de baja')
