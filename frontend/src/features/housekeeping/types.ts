import type { IsoDateTime, Money } from '@/types/api'

export type CleaningTaskStatus =
  'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED' | 'CANCELLED'

export type MaintenanceStatus =
  'REPORTED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface CleaningTask {
  id: number
  room: number
  room_number: string
  stay: number | null
  task_type: 'CHECKOUT' | 'PREVENTIVE' | 'DEEP' | 'INSPECTION'
  task_type_display: string
  status: CleaningTaskStatus
  status_display: string
  priority: number
  assigned_to: number | null
  assigned_to_name: string | null
  assigned_at: IsoDateTime | null
  started_at: IsoDateTime | null
  finished_at: IsoDateTime | null
  duration_seconds: number | null
  elapsed_seconds: number | null
  verified_by: number | null
  verified_at: IsoDateTime | null
  notes: string
  found_issues: boolean
  cancellation_reason: string
  created_at: IsoDateTime
}

export interface MaintenanceUpdate {
  id: number
  note: string
  status_before: MaintenanceStatus
  status_after: MaintenanceStatus
  created_by: number | null
  created_by_name: string | null
  created_at: IsoDateTime
}

export interface MaintenanceReport {
  id: number
  folio: string
  room: number | null
  room_number: string | null
  area: string
  title: string
  description: string
  category: string
  category_display: string
  priority: MaintenancePriority
  priority_display: string
  status: MaintenanceStatus
  status_display: string
  blocks_room: boolean
  reported_by: number
  reported_by_name: string
  assigned_to: number | null
  assigned_to_name: string | null
  cleaning_task: number | null
  resolved_at: IsoDateTime | null
  resolved_by: number | null
  resolution_notes: string
  cost: Money
  cancellation_reason: string
  created_at: IsoDateTime
  updates: MaintenanceUpdate[]
}

export interface CleaningPerformance {
  employee_id: number | null
  employee: string | null
  tasks: number
  average_seconds: number | null
  total_seconds: number
  issues_reported: number
}

export interface MaintenancePayload {
  title: string
  description: string
  room_id?: number | null
  area?: string
  category?: string
  priority?: MaintenancePriority
  blocks_room?: boolean
  cleaning_task_id?: number | null
}

export interface MaintenanceTransitionPayload {
  new_status: MaintenanceStatus
  note?: string
  assigned_to_id?: number | null
  resolution_notes?: string
  cost?: string
}
