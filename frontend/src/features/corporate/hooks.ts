import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/axios'
import { corporateApi } from './api'

const key = ['corporate'] as const

export const useCorporateDashboard = () => useQuery({ queryKey: [...key, 'dashboard'], queryFn: corporateApi.dashboard })
export const useCorporateMotels = () => useQuery({ queryKey: [...key, 'motels'], queryFn: corporateApi.motels })
export const useCorporateGroups = () => useQuery({ queryKey: [...key, 'groups'], queryFn: corporateApi.groups })
export const useCorporateRegions = () => useQuery({ queryKey: [...key, 'regions'], queryFn: corporateApi.regions })
export const useCorporateUsers = () => useQuery({ queryKey: [...key, 'users'], queryFn: corporateApi.users })

export function useCorporateMutation<T>(fn: (body: T) => Promise<unknown>, message: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      toast.success(message)
    },
    onError: (error) => toast.error('No se pudo guardar', apiErrorMessage(error)),
  })
}
