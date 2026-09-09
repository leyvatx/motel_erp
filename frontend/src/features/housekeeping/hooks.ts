import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { toast } from '@/components/ui/toast'
import { housekeepingApi } from '@/features/housekeeping/api'
import type {
  MaintenancePayload,
  MaintenanceTransitionPayload,
} from '@/features/housekeeping/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'

export function useCleaningBoard(mine = false, enabled = true) {
  return useQuery({
    queryKey: queryKeys.housekeeping.board(mine),
    queryFn: () => housekeepingApi.board(mine),
    enabled,
  })
}

export function useCleaningPerformance(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.housekeeping.performance(params),
    queryFn: () => housekeepingApi.performance(params),
  })
}

export function useMaintenanceReports(status?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.housekeeping.maintenance({ status }),
    queryFn: () => housekeepingApi.maintenance({ status, page_size: 50 }),
    enabled,
  })
}

/** La ficha completa de un reporte.
 *
 *  El listado devuelve una versión corta -- sin descripción ni seguimiento --
 *  porque son cientos de renglones. El detalle se pide al abrirlo: sin esto el
 *  diálogo intentaba recorrer un historial que nunca venía en la lista. */
export function useMaintenanceReport(reportId: number | null) {
  return useQuery({
    queryKey: queryKeys.housekeeping.maintenance({ id: reportId }),
    queryFn: () => housekeepingApi.maintenanceDetail(reportId as number),
    enabled: reportId !== null,
  })
}

export function useOpenMaintenance(enabled = true) {
  return useQuery({
    queryKey: queryKeys.housekeeping.maintenance({ open: true }),
    queryFn: housekeepingApi.openMaintenance,
    enabled,
  })
}

function useHousekeepingInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.grid })
    void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.summary })
  }
}

export function useStartCleaning() {
  const { t } = useTranslation()
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (taskId: number) => housekeepingApi.start(taskId),
    onSuccess: (task) => {
      invalidate()
      toast.info(t('limpieza.limpiezaIniciada', { numero: task.room_number }))
    },
    onError: (error) => toast.error(t('limpieza.noSePudoIniciar'), apiErrorMessage(error)),
  })
}

export function useFinishCleaningTask() {
  const { t } = useTranslation()
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: ({
      taskId,
      notes,
      foundIssues,
    }: {
      taskId: number
      notes: string
      foundIssues: boolean
    }) => housekeepingApi.finish(taskId, notes, foundIssues),
    onSuccess: (task) => {
      invalidate()
      const minutos = Math.round((task.duration_seconds ?? 0) / 60)
      toast.success(
        t('limpieza.habitacionLista', { numero: task.room_number }),
        t('limpieza.tiempoDeLimpieza', { minutos }),
      )
    },
    onError: (error) => toast.error(t('limpieza.noSePudoCerrarTarea'), apiErrorMessage(error)),
  })
}

export function useAssignCleaning() {
  const { t } = useTranslation()
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: ({ taskId, employeeId }: { taskId: number; employeeId: number }) =>
      housekeepingApi.assign(taskId, employeeId),
    onSuccess: () => {
      invalidate()
      toast.success(t('limpieza.tareaAsignada'))
    },
    onError: (error) => toast.error(t('limpieza.noSePudoAsignar'), apiErrorMessage(error)),
  })
}

export function useReportMaintenance() {
  const { t } = useTranslation()
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (payload: MaintenancePayload) => housekeepingApi.report(payload),
    onSuccess: (report) => {
      invalidate()
      toast.warning(t('limpieza.reporteLevantado', { folio: report.folio }), report.title)
    },
    onError: (error) => toast.error(t('limpieza.noSePudoReportar'), apiErrorMessage(error)),
  })
}

export function useMaintenanceTransition(reportId: number) {
  const { t } = useTranslation()
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (payload: MaintenanceTransitionPayload) =>
      housekeepingApi.transition(reportId, payload),
    onSuccess: (report) => {
      invalidate()
      toast.success(`Reporte ${report.folio}: ${report.status_display}`)
    },
    onError: (error) => toast.error(t('limpieza.noSePudoActualizar'), apiErrorMessage(error)),
  })
}
