import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { authApi, type LoginPayload } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryClient'
import { realtimeChannels } from '@/lib/websocket'
import { useAuthStore } from '@/store/auth'
import type { LoginResponse, User } from '@/types/api'

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()

  return useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setSession(data)
      navigate(data.user.role === 'HOUSEKEEPING' ? '/housekeeping' : '/frontdesk', {
        replace: true,
      })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      const refresh = useAuthStore.getState().refresh
      if (refresh) {
        await authApi.logout(refresh).catch(() => undefined)
      }
    },
    onSettled: () => {
      realtimeChannels.forEach((channel) => channel.disconnect())
      useAuthStore.getState().clear()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}

export function useCurrentUser() {
  const access = useAuthStore((state) => state.access)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery<User>({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const user = await authApi.me()
      setUser(user)
      return user
    },
    enabled: Boolean(access),
    staleTime: 5 * 60_000,
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword })
}
