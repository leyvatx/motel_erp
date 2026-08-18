import { get } from '@/lib/axios'
import type { PlatformMotel } from '@/features/platform/types'
import type { ListParams, PaginatedResponse } from '@/types/api'

export const platformApi = {
  motels: (params?: ListParams): Promise<PaginatedResponse<PlatformMotel>> =>
    get<PaginatedResponse<PlatformMotel>>('/settings/motels/', { params }),
}
