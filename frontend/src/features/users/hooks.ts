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

export function useRoleMatrix() {
  return useQuery({
    queryKey: queryKeys.users.roleMatrix,
    queryFn: usersApi.roleMatrix,
    // La matriz vive en código: no cambia sin un despliegue de por medio.
    staleTime: Infinity,
  })
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.users.sessions,
    queryFn: usersApi.sessions,
    // La marca de actividad se refresca sola cada dos minutos en el servidor;
    // pedirla más seguido solo repetiría el mismo dato.
    refetchInterval: 60_000,
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: usersApi.revokeSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions })
      toast.success('Sesión cerrada', 'Deja de operar en su siguiente acción.')
    },
    onError: (error) => toast.error('No se pudo cerrar la sesión', apiErrorMessage(error)),
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
