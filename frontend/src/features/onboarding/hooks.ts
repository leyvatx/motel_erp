import { useQuery } from '@tanstack/react-query'

import { useBusinessProfile } from '@/features/config/hooks'
import { frontdeskApi } from '@/features/frontdesk/api'
import { queryKeys } from '@/lib/queryClient'
import { canAccessSection, useAuthStore } from '@/store/auth'

/** El nombre con el que el backend siembra la primera sucursal cuando nadie le
 *  dio uno. Mientras siga puesto, el negocio no se ha presentado. */
const NOMBRE_SEMBRADO = 'Mi negocio'

export type SetupStepId = 'business' | 'roomType' | 'tariff' | 'rooms'

export interface SetupStep {
  id: SetupStepId
  label: string
  hint: string
  done: boolean
}

export interface SetupStatus {
  steps: SetupStep[]
  pending: SetupStep[]
  complete: boolean
  loading: boolean
  /** Falso para recepción, ama de llaves, plataforma y corporativo sin sucursal
   *  activa: nadie de ellos puede crear tarifas ni habitaciones. */
  applies: boolean
}

export function useSetupStatus(): SetupStatus {
  const user = useAuthStore((state) => state.user)
  const applies = canAccessSection(user, 'config')

  const business = useBusinessProfile()

  const roomTypes = useQuery({
    queryKey: queryKeys.frontdesk.roomTypes,
    queryFn: frontdeskApi.roomTypes,
    enabled: applies,
    staleTime: 10 * 60_000,
  })

  const tariffs = useQuery({
    queryKey: ['frontdesk', 'tariff-blocks', 'all'] as const,
    queryFn: () => frontdeskApi.tariffBlocks(),
    enabled: applies,
  })

  const rooms = useQuery({
    queryKey: queryKeys.frontdesk.rooms({ setup: true }),
    queryFn: () => frontdeskApi.rooms({ page: 1, page_size: 1 }),
    enabled: applies,
  })

  const nombre = business.data?.name?.trim() ?? ''

  const steps: SetupStep[] = [
    {
      id: 'business',
      label: 'Nombre y logotipo',
      hint: 'Aparecen en el menú, en la pantalla de acceso y en el ticket.',
      done: nombre.length > 0 && nombre !== NOMBRE_SEMBRADO,
    },
    {
      id: 'roomType',
      label: 'Un tipo de habitación',
      hint: 'Agrupa las habitaciones que comparten capacidad y precio.',
      done: (roomTypes.data?.count ?? 0) > 0,
    },
    {
      id: 'tariff',
      label: 'Una tarifa base',
      hint: 'Cuánto cuesta y cuánto dura la estancia que más se vende.',
      done: (tariffs.data?.count ?? 0) > 0,
    },
    {
      id: 'rooms',
      label: 'Las habitaciones',
      hint: 'Sin al menos una, recepción no tiene nada que rentar.',
      done: (rooms.data?.count ?? 0) > 0,
    },
  ]

  const loading =
    business.isPending || roomTypes.isPending || tariffs.isPending || rooms.isPending

  const pending = steps.filter((step) => !step.done)

  return {
    steps,
    pending,
    complete: pending.length === 0,
    loading: applies && loading,
    applies,
  }
}
