import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import { usersApi } from '@/features/users/api'
import type { UserListParams, UserPayload } from '@/features/users/types'
import { apiErrorMessage } from '@/lib/axios'
import { queryKeys } from '@/lib/queryClient'

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: (previous) => previous,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.users.roles,
    queryFn: usersApi.roles,
    staleTime: Infinity,
  })
}

function useUserMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(successMessage)
    },
    onError: (error) => toast.error('No se pudo completar la operación', apiErrorMessage(error)),
  })
}

export const useCreateUser = () => useUserMutation(usersApi.create, 'Usuario creado')

export const useUpdateUser = () =>
  useUserMutation(
    ({ id, payload }: { id: number; payload: UserPayload }) => usersApi.update(id, payload),
    'Usuario actualizado',
  )

export const useDeactivateUser = () => useUserMutation(usersApi.deactivate, 'Usuario desactivado')

export const useRestoreUser = () => useUserMutation(usersApi.restore, 'Usuario reactivado')

export const useForcePasswordChange = () =>
  useUserMutation(usersApi.forcePasswordChange, 'Cambio de contraseña solicitado')
