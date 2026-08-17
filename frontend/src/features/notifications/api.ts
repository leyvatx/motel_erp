import { get, post } from '@/lib/axios'
import type { IsoDateTime, ListParams, NotificationLevel, PaginatedResponse } from '@/types/api'

export interface Notification {
  id: number
  category: string
  category_display: string
  level: NotificationLevel
  level_display: string
  title: string
  body: string
  payload: Record<string, unknown>
  target_role: string
  target_user: number | null
  read_at: IsoDateTime | null
  is_read: boolean
  created_at: IsoDateTime
}

export interface UnreadCount {
  unread: number
  critical: number
}

export interface NotificationParams extends ListParams {
  unread?: 'true'
  category?: string
  level?: NotificationLevel
}

export const notificationsApi = {
  list: (params?: NotificationParams): Promise<PaginatedResponse<Notification>> =>
    get<PaginatedResponse<Notification>>('/notifications/', { params }),

  unreadCount: (): Promise<UnreadCount> => get<UnreadCount>('/notifications/unread-count/'),

  markRead: (ids: number[]): Promise<UnreadCount> =>
    post<UnreadCount, { ids: number[] }>('/notifications/mark-read/', { ids }),

  markAllRead: (): Promise<UnreadCount> => post<UnreadCount>('/notifications/mark-all-read/'),
}
