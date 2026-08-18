import { useQuery } from '@tanstack/react-query'

import { api, get } from '@/lib/axios'
import type { IsoDateTime, PaginatedResponse } from '@/types/api'

export interface AuditLog {
  id: number
  created_at: IsoDateTime
  actor: number | null
  actor_name: string | null
  actor_username: string
  action: string
  action_display: string
  module: string
  module_display: string
  description: string
  target_model: string | null
  object_id: number | null
  object_repr: string
  changes: Record<string, { before: unknown; after: unknown }>
  extra: Record<string, unknown>
  ip_address: string | null
  user_agent: string
}

export interface AuditParams {
  page?: number
  page_size?: number
  action?: string
  module?: string
  actor?: number
  search?: string
  from?: string
  to?: string
  target?: string
  object_id?: number
}

export interface AuditSummary {
  action: string
  action_display: string
  total: number
}

export interface AuditFilterOptions {
  actions: { value: string; label: string }[]
  modules: { value: string; label: string }[]
  actors: { value: number; label: string }[]
}

export const auditKeys = {
  logs: (params?: AuditParams) => ['audit', 'logs', params ?? {}] as const,
  summary: (params?: AuditParams) => ['audit', 'summary', params ?? {}] as const,
  filters: ['audit', 'filters'] as const,
}

export function useAuditLogs(params: AuditParams, enabled = true) {
  return useQuery({
    queryKey: auditKeys.logs(params),
    queryFn: () => get<PaginatedResponse<AuditLog>>('/audit/logs/', { params }),
    enabled,
  })
}

export function useAuditSummary(params: AuditParams) {
  return useQuery({
    queryKey: auditKeys.summary(params),
    queryFn: () => get<AuditSummary[]>('/audit/logs/summary/', { params }),
  })
}

export function useAuditFilterOptions() {
  return useQuery({
    queryKey: auditKeys.filters,
    queryFn: () => get<AuditFilterOptions>('/audit/logs/filters/'),
    staleTime: 5 * 60_000,
  })
}

export async function exportAuditLogs(params: AuditParams): Promise<Blob> {
  const { data } = await api.get<Blob>('/audit/logs/export/', {
    params,
    responseType: 'blob',
  })
  return data
}
