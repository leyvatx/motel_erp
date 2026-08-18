import { useQuery } from '@tanstack/react-query'

import { platformApi } from '@/features/platform/api'
import { queryKeys } from '@/lib/queryClient'
import type { ListParams } from '@/types/api'

export function usePlatformMotels(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.platform.motels(params),
    queryFn: () => platformApi.motels(params),
  })
}
