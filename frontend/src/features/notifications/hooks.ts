import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notificationsApi, type NotificationParams } from '@/features/notifications/api'
import { queryKeys } from '@/lib/queryClient'

export function useNotifications(params?: NotificationParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.list(params),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 120_000,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: number[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
    },
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
    },
  })
}
