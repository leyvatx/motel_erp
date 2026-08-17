import { get, post } from '@/lib/axios'
import type { ListParams, PaginatedResponse } from '@/types/api'
import type {
  CleaningPerformance,
  CleaningTask,
  MaintenancePayload,
  MaintenanceReport,
  MaintenanceTransitionPayload,
} from '@/features/housekeeping/types'

export const housekeepingApi = {
  board: (mine = false): Promise<PaginatedResponse<CleaningTask>> =>
    get<PaginatedResponse<CleaningTask>>('/housekeeping/cleaning-tasks/board/', {
      params: { mine: mine ? 'true' : undefined, page_size: 100 },
    }),

  tasks: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<CleaningTask>> =>
    get<PaginatedResponse<CleaningTask>>('/housekeeping/cleaning-tasks/', { params }),

  assign: (taskId: number, employeeId: number): Promise<CleaningTask> =>
    post<CleaningTask, { employee_id: number }>(
      `/housekeeping/cleaning-tasks/${taskId}/assign/`,
      { employee_id: employeeId },
    ),

  start: (taskId: number): Promise<CleaningTask> =>
    post<CleaningTask>(`/housekeeping/cleaning-tasks/${taskId}/start/`),

  finish: (taskId: number, notes: string, foundIssues: boolean): Promise<CleaningTask> =>
    post<CleaningTask, { notes: string; found_issues: boolean }>(
      `/housekeeping/cleaning-tasks/${taskId}/finish/`,
      { notes, found_issues: foundIssues },
    ),

  verify: (taskId: number): Promise<CleaningTask> =>
    post<CleaningTask>(`/housekeeping/cleaning-tasks/${taskId}/verify/`),

  performance: (params?: { from?: string; to?: string }): Promise<CleaningPerformance[]> =>
    get<CleaningPerformance[]>('/housekeeping/cleaning-tasks/performance/', { params }),

  maintenance: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<MaintenanceReport>> =>
    get<PaginatedResponse<MaintenanceReport>>('/housekeeping/maintenance/', { params }),

  openMaintenance: (): Promise<PaginatedResponse<MaintenanceReport>> =>
    get<PaginatedResponse<MaintenanceReport>>('/housekeeping/maintenance/open/'),

  report: (payload: MaintenancePayload): Promise<MaintenanceReport> =>
    post<MaintenanceReport, MaintenancePayload>('/housekeeping/maintenance/', payload),

  transition: (
    reportId: number,
    payload: MaintenanceTransitionPayload,
  ): Promise<MaintenanceReport> =>
    post<MaintenanceReport, MaintenanceTransitionPayload>(
      `/housekeeping/maintenance/${reportId}/transition/`,
      payload,
    ),
}
