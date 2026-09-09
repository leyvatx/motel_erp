import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18n from '@/lib/i18n'

import { toast } from '@/components/ui/toast'
import { businessApi, configApi } from '@/features/config/api'
import { frontdeskApi } from '@/features/frontdesk/api'
import type { BusinessProfilePayload } from '@/features/config/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'
import { useAuthStore } from '@/store/auth'

export function useBusinessProfile() {
  const authenticated = useAuthStore((state) => Boolean(state.access))
  const platform = useAuthStore((state) => Boolean(state.user?.is_platform_admin))
  const corporateWithoutMotel = useAuthStore((state) =>
    Boolean(state.user?.is_corporate_user && !state.activeMotelId),
  )

  return useQuery({
    queryKey: queryKeys.settings.business,
    queryFn: businessApi.profile,
    enabled: authenticated && !platform && !corporateWithoutMotel,
    staleTime: 10 * 60_000,
  })
}

export function usePublicBusinessProfile() {
  const authenticated = useAuthStore((state) => Boolean(state.access))
  const motelSlug = useAuthStore((state) => state.motelSlug)

  return useQuery({
    queryKey: [...queryKeys.settings.publicBusiness, motelSlug],
    queryFn: () => businessApi.public(motelSlug),
    enabled: !authenticated,
    staleTime: 10 * 60_000,
  })
}

export function useBrand(): { name: string; logoUrl: string | null } {
  const profile = useBusinessProfile()
  const publicProfile = usePublicBusinessProfile()
  const source = profile.data ?? publicProfile.data

  return {
    name: source?.name ?? '',
    logoUrl: source?.logo_url ?? null,
  }
}

export function useTimeZones() {
  return useQuery({
    queryKey: queryKeys.settings.timeZones,
    queryFn: businessApi.timeZones,
    staleTime: Infinity,
  })
}

function useBusinessMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success(successMessage)
    },
    onError: (error) => toast.error(i18n.t('config.noSePudoGuardar'), apiErrorMessage(error)),
  })
}

export const useUpdateBusinessProfile = () =>
  useBusinessMutation(
    (payload: BusinessProfilePayload) => businessApi.update(payload),
    i18n.t('config.configuracionGuardada'),
  )

export const useUpdateBusinessLogo = () =>
  useBusinessMutation((file: File | null) => businessApi.updateLogo(file), 'Logotipo actualizado')

export function useAllRooms(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.frontdesk.rooms({ page, pageSize }),
    queryFn: () => frontdeskApi.rooms({ page, page_size: pageSize, ordering: 'number' }),
    placeholderData: (previous) => previous,
  })
}

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
    onError: (error) => toast.error(i18n.t('config.noSePudoGuardar'), apiErrorMessage(error)),
  })
}

export const useCreateRoom = () =>
  useConfigMutation(configApi.createRoom, i18n.t('config.habitacionCreada'))

export const useUpdateRoom = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateRoom>[1] }) =>
      configApi.updateRoom(id, payload),
    i18n.t('config.habitacionActualizada'),
  )

export const useDeactivateRoom = () =>
  useConfigMutation(configApi.deactivateRoom, i18n.t('config.habitacionDadaDeBaja'))

export const useCreateRoomType = () =>
  useConfigMutation(configApi.createRoomType, i18n.t('config.tipoDeHabitacionCreado'))

export const useUpdateRoomType = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateRoomType>[1] }) =>
      configApi.updateRoomType(id, payload),
    'Tipo actualizado',
  )

export const useDeactivateRoomType = () =>
  useConfigMutation(configApi.deactivateRoomType, i18n.t('config.tipoDadoDeBaja'))

export const useCreateTariff = () => useConfigMutation(configApi.createTariff, 'Tarifa creada')

export const useUpdateTariff = () =>
  useConfigMutation(
    ({ id, payload }: { id: number; payload: Parameters<typeof configApi.updateTariff>[1] }) =>
      configApi.updateTariff(id, payload),
    'Tarifa actualizada',
  )

export const useDeactivateTariff = () =>
  useConfigMutation(configApi.deactivateTariff, i18n.t('config.tarifaDadaDeBaja'))

export const useTariffRules = () =>
  useQuery({ queryKey: ['frontdesk', 'tariff-rules'], queryFn: configApi.tariffRules })
export const useCreateTariffRule = () =>
  useConfigMutation(configApi.createTariffRule, 'Regla tarifaria creada')
export const useDeactivateTariffRule = () =>
  useConfigMutation(configApi.deactivateTariffRule, 'Regla tarifaria desactivada')
export const useHolidays = () =>
  useQuery({ queryKey: ['frontdesk', 'holidays'], queryFn: configApi.holidays })
export const useCreateHoliday = () =>
  useConfigMutation(configApi.createHoliday, i18n.t('config.diaFestivoAgregado'))
export const useDeactivateHoliday = () =>
  useConfigMutation(configApi.deactivateHoliday, i18n.t('config.diaFestivoEliminado'))
