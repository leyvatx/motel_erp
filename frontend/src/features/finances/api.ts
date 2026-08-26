import { get, post } from '@/lib/axios'
import type { ListParams, PaginatedResponse } from '@/types/api'
import type {
  CashMovement,
  CloseShiftPayload,
  Expense,
  ExpensePayload,
  OpenShiftPayload,
  Shift,
  ShiftTrend,
} from '@/features/finances/types'

export const financesApi = {
  currentShift: (): Promise<Shift> => get<Shift>('/finances/shifts/current/'),

  shiftTrend: (): Promise<ShiftTrend> => get<ShiftTrend>('/finances/shifts/trend/'),

  shifts: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<Shift>> =>
    get<PaginatedResponse<Shift>>('/finances/shifts/', { params }),

  openShift: (payload: OpenShiftPayload): Promise<Shift> =>
    post<Shift, OpenShiftPayload>('/finances/shifts/open/', payload),

  closeShift: (shiftId: number, payload: CloseShiftPayload): Promise<Shift> =>
    post<Shift, CloseShiftPayload>(`/finances/shifts/${shiftId}/close/`, payload),

  cashMovement: (
    shiftId: number,
    payload: { direction: 'IN' | 'OUT'; amount: string; reason?: string; description?: string },
  ): Promise<CashMovement> =>
    post<CashMovement, typeof payload>(`/finances/shifts/${shiftId}/cash-movements/`, payload),

  printShiftReport: (shiftId: number): Promise<{ receipt_id: number; preview: string }> =>
    post<{ receipt_id: number; preview: string }>(`/finances/shifts/${shiftId}/print-report/`),

  denominations: (): Promise<{ denominations: string[] }> =>
    get<{ denominations: string[] }>('/finances/shifts/denominations/'),

  expenses: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<Expense>> =>
    get<PaginatedResponse<Expense>>('/finances/expenses/', { params }),

  pendingExpenses: (): Promise<PaginatedResponse<Expense>> =>
    get<PaginatedResponse<Expense>>('/finances/expenses/pending/'),

  createExpense: (payload: ExpensePayload): Promise<Expense> =>
    post<Expense, ExpensePayload>('/finances/expenses/', payload),

  reviewExpense: (expenseId: number, approve: boolean, notes?: string): Promise<Expense> =>
    post<Expense, { approve: boolean; notes?: string }>(`/finances/expenses/${expenseId}/review/`, {
      approve,
      notes,
    }),
}
