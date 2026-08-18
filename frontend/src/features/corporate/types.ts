import type { Role } from '@/types/api'

export interface CorporateMotel {
  id: number
  slug: string
  name: string
  group_id: number | null
  group_name: string | null
  region_id: number | null
  region_name: string | null
  access_role: Role
}

export interface CorporateMotelMetric {
  motel_id: number
  motel_name: string
  group_name: string | null
  region_name: string | null
  rooms: number
  occupied: number
  occupancy_rate: number
  revenue_24h: string
}

export interface CorporateDashboard {
  generated_at: string
  period_hours: number
  totals: {
    groups: number
    regions: number
    motels: number
    rooms: number
    occupied: number
    revenue_24h: string
  }
  motels: CorporateMotelMetric[]
}

export interface MotelGroup {
  id: number
  code: string
  name: string
  description: string
  region_count: number
  motel_count: number
}

export interface MotelRegion {
  id: number
  group: number
  group_name: string
  code: string
  name: string
  description: string
  motel_count: number
}

export interface CorporateUser {
  id: number
  username: string
  full_name: string
  email: string
  phone: string
  role: Role
  is_active: boolean
}

export interface BulkPreview {
  dry_run: boolean
  target_count: number
  targets: { id: number; name: string }[]
  changes: Record<string, unknown>
  applied?: boolean
}
