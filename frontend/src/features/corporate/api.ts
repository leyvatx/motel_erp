import { get, post, put } from '@/lib/axios'
import type { PaginatedResponse, Role } from '@/types/api'
import type {
  BulkPreview,
  CorporateDashboard,
  CorporateMotel,
  CorporateUser,
  MotelGroup,
  MotelRegion,
} from './types'

export const corporateApi = {
  dashboard: () => get<CorporateDashboard>('/corporate/dashboard/'),
  motels: () => get<CorporateMotel[]>('/corporate/motels/'),
  groups: () =>
    get<PaginatedResponse<MotelGroup>>('/corporate/groups/', { params: { page_size: 100 } }),
  regions: () =>
    get<PaginatedResponse<MotelRegion>>('/corporate/regions/', { params: { page_size: 250 } }),
  users: () =>
    get<PaginatedResponse<CorporateUser>>('/corporate/users/', { params: { page_size: 250 } }),
  createGroup: (body: { code: string; name: string }) =>
    post<MotelGroup>('/corporate/groups/', body),
  createRegion: (body: { group: number; code: string; name: string }) =>
    post<MotelRegion>('/corporate/regions/', body),
  createUser: (body: {
    username: string
    full_name: string
    password: string
    role: Role
    region: number
    access_role: Role
  }) => post<CorporateUser>('/corporate/users/', body),
  assignRegionMotels: (region: number, motel_ids: number[]) =>
    put(`/corporate/regions/${region}/motels/`, { motel_ids }),
  createAccess: (body: { user: number; region: number; role: Role }) =>
    post('/corporate/accesses/', body),
  bulkConfig: (body: { region_id: number; changes: Record<string, unknown>; dry_run: boolean }) =>
    post<BulkPreview>('/corporate/bulk-config/', body),
}
