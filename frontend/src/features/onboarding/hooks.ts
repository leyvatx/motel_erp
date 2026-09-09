import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useBusinessProfile } from '@/features/config/hooks'
import { frontdeskApi } from '@/features/frontdesk/api'
import { queryKeys } from '@/lib/queryClient'
import { canAccessSection, useAuthStore } from '@/store/auth'

/** El nombre con el que el backend siembra la primera sucursal cuando nadie le
 *  dio uno. Mientras siga puesto, el negocio no se ha presentado.
 *
 *  Tiene que coincidir con `BUSINESS_NAME` de api/core/settings.py. */
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
  const { t } = useTranslation()
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

  /** El nombre cuenta como puesto por alguien, no como valor de fábrica. */
  const nombrePropio = nombre.length > 0 && nombre !== NOMBRE_SEMBRADO

  /* El logotipo no entra en la cuenta a propósito. Esta lista dice qué le falta
   * al negocio para poder rentar, y sin logotipo se renta igual: exigirlo dejaba
   * "Faltan 4 de 4" en la pantalla de inicio de un negocio que ya tiene su
   * nombre puesto y funcionando, sin manera de quitarlo salvo subir una imagen
   * que quizá no existe todavía. Se sube en este mismo paso -- alcanzable con
   * el botón de atrás del asistente y desde Configuración -- pero no bloquea. */

  const steps: SetupStep[] = [
    {
      id: 'business',
      label: t('asistente.nombreDelNegocio'),
      hint: t('asistente.apareceEnElMenu'),
      done: nombrePropio,
    },
    {
      id: 'roomType',
      label: t('asistente.unTipoDeHabitacion'),
      hint: t('asistente.agrupaLasHabitaciones'),
      done: (roomTypes.data?.count ?? 0) > 0,
    },
    {
      id: 'tariff',
      label: t('asistente.unaTarifaBase'),
      hint: t('asistente.cuantoCuestaDura'),
      done: (tariffs.data?.count ?? 0) > 0,
    },
    {
      id: 'rooms',
      label: t('asistente.lasHabitaciones'),
      hint: t('asistente.sinAlMenosUna'),
      done: (rooms.data?.count ?? 0) > 0,
    },
  ]

  const loading = business.isPending || roomTypes.isPending || tariffs.isPending || rooms.isPending

  const pending = steps.filter((step) => !step.done)

  return {
    steps,
    pending,
    complete: pending.length === 0,
    loading: applies && loading,
    applies,
  }
}
