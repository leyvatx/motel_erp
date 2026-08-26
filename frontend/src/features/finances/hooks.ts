import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { toast } from '@/components/ui/toast'
import { financesApi } from '@/features/finances/api'
import { toastApiError } from '@/features/finances/shiftGuard'
import type { CloseShiftPayload, ExpensePayload, OpenShiftPayload } from '@/features/finances/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'

/** Serie por hora del turno abierto. Se refresca sola cada 5 min: la gráfica
 *  es contexto, no un cronómetro, y no vale una petición por minuto. */
export function useShiftTrend(enabled = true) {
  return useQuery({
    queryKey: queryKeys.finances.shiftTrend,
    queryFn: financesApi.shiftTrend,
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useCurrentShift(enabled = true) {
  return useQuery({
    queryKey: queryKeys.finances.currentShift,
    queryFn: async () => {
      try {
        return await financesApi.currentShift()
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return null
        throw error
      }
    },
    enabled,
  })
}

export function useShifts(status?: string) {
  return useQuery({
    queryKey: queryKeys.finances.shifts({ status }),
    queryFn: () => financesApi.shifts({ status, page_size: 30 }),
  })
}

export function useExpenses(status?: string) {
  return useQuery({
    queryKey: queryKeys.finances.expenses({ status }),
    queryFn: () => financesApi.expenses({ status, page_size: 50 }),
  })
}

export function usePendingExpenses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.finances.pendingExpenses,
    queryFn: financesApi.pendingExpenses,
    enabled,
  })
}

function useFinancesInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['finances'] })
  }
}

export function useOpenShift() {
  const invalidate = useFinancesInvalidation()

  return useMutation({
    mutationFn: (payload: OpenShiftPayload) => financesApi.openShift(payload),
    onSuccess: (shift) => {
      invalidate()
      toast.success(`Turno ${shift.code} abierto`, `Fondo inicial ${shift.opening_balance}`)
    },
    onError: (error) => toast.error('No se pudo abrir el turno', apiErrorMessage(error)),
  })
}

export function useCloseShift(shiftId: number) {
  const invalidate = useFinancesInvalidation()

  return useMutation({
    mutationFn: (payload: CloseShiftPayload) => financesApi.closeShift(shiftId, payload),
    onSuccess: (shift) => {
      invalidate()
      const diferencia = Number.parseFloat(shift.difference)
      if (diferencia === 0) {
        toast.success(`Turno ${shift.code} cerrado`, 'El corte cuadro exacto.')
      } else {
        toast.warning(
          `Turno ${shift.code} cerrado`,
          `${diferencia < 0 ? 'Faltante' : 'Sobrante'} de ${shift.difference}.`,
        )
      }
    },
    onError: (error) => toast.error('No se pudo cerrar el turno', apiErrorMessage(error)),
  })
}

export function useCashMovement(shiftId: number) {
  const invalidate = useFinancesInvalidation()

  return useMutation({
    mutationFn: (payload: {
      direction: 'IN' | 'OUT'
      amount: string
      reason?: string
      description?: string
    }) => financesApi.cashMovement(shiftId, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Movimiento de efectivo registrado')
    },
    onError: (error) => toast.error('No se pudo registrar', apiErrorMessage(error)),
  })
}

export function useCreateExpense() {
  const invalidate = useFinancesInvalidation()

  return useMutation({
    mutationFn: (payload: ExpensePayload) => financesApi.createExpense(payload),
    onSuccess: (expense) => {
      invalidate()
      if (expense.requires_approval) {
        toast.info(
          `Gasto ${expense.folio} en espera`,
          'Supera el umbral: gerencia debe aprobarlo antes de salir de caja.',
        )
      } else {
        toast.success(`Gasto ${expense.folio} registrado`)
      }
    },
    onError: (error) => toastApiError('No se pudo registrar el gasto', error),
  })
}

export function useReviewExpense() {
  const invalidate = useFinancesInvalidation()

  return useMutation({
    mutationFn: ({
      expenseId,
      approve,
      notes,
    }: {
      expenseId: number
      approve: boolean
      notes?: string
    }) => financesApi.reviewExpense(expenseId, approve, notes),
    onSuccess: (expense) => {
      invalidate()
      toast.success(
        `Gasto ${expense.folio} ${expense.status === 'APPROVED' ? 'aprobado' : 'rechazado'}`,
      )
    },
    onError: (error) => toast.error('No se pudo revisar', apiErrorMessage(error)),
  })
}

export function usePrintShiftReport() {
  return useMutation({
    mutationFn: (shiftId: number) => financesApi.printShiftReport(shiftId),
    onSuccess: () => toast.success('Corte enviado a la impresora'),
    onError: (error) => toast.error('No se pudo imprimir', apiErrorMessage(error)),
  })
}
