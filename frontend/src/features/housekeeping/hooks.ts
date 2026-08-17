import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import { housekeepingApi } from '@/features/housekeeping/api'
import type {
  MaintenancePayload,
  MaintenanceTransitionPayload,
} from '@/features/housekeeping/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'

export function useCleaningBoard(mine = false) {
  return useQuery({
    queryKey: queryKeys.housekeeping.board(mine),
    queryFn: () => housekeepingApi.board(mine),
  })
}

export function useCleaningPerformance(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.housekeeping.performance(params),
    queryFn: () => housekeepingApi.performance(params),
  })
}

export function useMaintenanceReports(status?: string) {
  return useQuery({
    queryKey: queryKeys.housekeeping.maintenance({ status }),
    queryFn: () => housekeepingApi.maintenance({ status, page_size: 50 }),
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
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (taskId: number) => housekeepingApi.start(taskId),
    onSuccess: (task) => {
      invalidate()
      toast.info(`Limpieza iniciada - habitación ${task.room_number}`)
    },
    onError: (error) => toast.error('No se pudo iniciar', apiErrorMessage(error)),
  })
}

export function useFinishCleaningTask() {
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: ({ taskId, notes, foundIssues }: { taskId: number; notes: string; foundIssues: boolean }) =>
      housekeepingApi.finish(taskId, notes, foundIssues),
    onSuccess: (task) => {
      invalidate()
      const minutos = Math.round((task.duration_seconds ?? 0) / 60)
      toast.success(
        `Habitación ${task.room_number} lista`,
        `Tiempo de limpieza: ${minutos} min.`,
      )
    },
    onError: (error) => toast.error('No se pudo cerrar la tarea', apiErrorMessage(error)),
  })
}

export function useAssignCleaning() {
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: ({ taskId, employeeId }: { taskId: number; employeeId: number }) =>
      housekeepingApi.assign(taskId, employeeId),
    onSuccess: () => {
      invalidate()
      toast.success('Tarea asignada')
    },
    onError: (error) => toast.error('No se pudo asignar', apiErrorMessage(error)),
  })
}

export function useReportMaintenance() {
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (payload: MaintenancePayload) => housekeepingApi.report(payload),
    onSuccess: (report) => {
      invalidate()
      toast.warning(`Reporte ${report.folio} levantado`, report.title)
    },
    onError: (error) => toast.error('No se pudo reportar', apiErrorMessage(error)),
  })
}

export function useMaintenanceTransition(reportId: number) {
  const invalidate = useHousekeepingInvalidation()

  return useMutation({
    mutationFn: (payload: MaintenanceTransitionPayload) =>
      housekeepingApi.transition(reportId, payload),
    onSuccess: (report) => {
      invalidate()
      toast.success(`Reporte ${report.folio}: ${report.status_display}`)
    },
    onError: (error) => toast.error('No se pudo actualizar', apiErrorMessage(error)),
  })
}
