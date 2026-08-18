import type { IsoDateTime } from '@/types/api'

export interface PlatformMotel {
  id: number
  slug: string
  name: string
  logo_url: string | null
  address: string
  phone: string
  currency: string
  time_zone: string
  is_active: boolean
  user_count: number
  room_count: number
  created_at: IsoDateTime
}
