import { del, get, patch, post } from '@/lib/axios'
import type { Room, RoomType, TariffBlock } from '@/features/frontdesk/types'
import type {
  BusinessProfile,
  BusinessProfilePayload,
  PublicBusinessProfile,
  TimeZoneOption,
} from '@/features/config/types'

export interface RoomPayload {
  number: string
  room_type: number
  floor: number
  zone?: string
  has_garage?: boolean
  notes?: string
}

export interface RoomTypePayload {
  name: string
  code: string
  description?: string
  max_occupants: number
  extra_person_price: string
  sort_order?: number
}

export interface TariffPayload {
  room_type: number
  name: string
  duration_minutes: number
  base_price: string
  grace_minutes?: number
  overstay_hour_price?: string
  is_overnight?: boolean
  is_default?: boolean
  sort_order?: number
}

export interface TariffRule {
  id: number
  tariff_block: number
  name: string
  rule_type: 'WEEKDAY' | 'DATE_RANGE' | 'HOLIDAY'
  rule_type_display: string
  weekdays: number[]
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  price_mode: 'FIXED' | 'MULTIPLIER' | 'DELTA'
  value: string
  priority: number
  is_active: boolean
}
export type TariffRulePayload = Omit<TariffRule, 'id' | 'rule_type_display' | 'is_active'>
export interface Holiday {
  id: number
  date: string
  name: string
  is_active: boolean
}

export const businessApi = {
  public: (slug: string | null): Promise<PublicBusinessProfile> =>
    get<PublicBusinessProfile>('/settings/business/public/', {
      params: slug ? { slug } : undefined,
    }),

  profile: (): Promise<BusinessProfile> => get<BusinessProfile>('/settings/business/'),

  update: (payload: BusinessProfilePayload): Promise<BusinessProfile> =>
    patch<BusinessProfile, BusinessProfilePayload>('/settings/business/', payload),

  updateLogo: (file: File | null): Promise<BusinessProfile> => {
    if (!file) {
      return patch<BusinessProfile, { logo: null }>('/settings/business/', { logo: null })
    }
    const form = new FormData()
    form.append('logo', file)
    return patch<BusinessProfile, FormData>('/settings/business/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  timeZones: (): Promise<TimeZoneOption[]> => get<TimeZoneOption[]>('/settings/time-zones/'),
}

export const configApi = {
  createRoom: (payload: RoomPayload): Promise<Room> =>
    post<Room, RoomPayload>('/frontdesk/rooms/', payload),
  updateRoom: (id: number, payload: Partial<RoomPayload>): Promise<Room> =>
    patch<Room, Partial<RoomPayload>>(`/frontdesk/rooms/${id}/`, payload),
  deactivateRoom: (id: number): Promise<void> => del(`/frontdesk/rooms/${id}/`),

  createRoomType: (payload: RoomTypePayload): Promise<RoomType> =>
    post<RoomType, RoomTypePayload>('/frontdesk/room-types/', payload),
  updateRoomType: (id: number, payload: Partial<RoomTypePayload>): Promise<RoomType> =>
    patch<RoomType, Partial<RoomTypePayload>>(`/frontdesk/room-types/${id}/`, payload),
  deactivateRoomType: (id: number): Promise<void> => del(`/frontdesk/room-types/${id}/`),

  createTariff: (payload: TariffPayload): Promise<TariffBlock> =>
    post<TariffBlock, TariffPayload>('/frontdesk/tariff-blocks/', payload),
  updateTariff: (id: number, payload: Partial<TariffPayload>): Promise<TariffBlock> =>
    patch<TariffBlock, Partial<TariffPayload>>(`/frontdesk/tariff-blocks/${id}/`, payload),
  deactivateTariff: (id: number): Promise<void> => del(`/frontdesk/tariff-blocks/${id}/`),

  tariffRules: (): Promise<import('@/types/api').PaginatedResponse<TariffRule>> =>
    get('/frontdesk/tariff-rules/', { params: { page_size: 200 } }),
  createTariffRule: (payload: TariffRulePayload): Promise<TariffRule> =>
    post<TariffRule, TariffRulePayload>('/frontdesk/tariff-rules/', payload),
  deactivateTariffRule: (id: number): Promise<void> => del(`/frontdesk/tariff-rules/${id}/`),
  holidays: (): Promise<import('@/types/api').PaginatedResponse<Holiday>> =>
    get('/frontdesk/holidays/', { params: { page_size: 200 } }),
  createHoliday: (payload: { date: string; name: string }): Promise<Holiday> =>
    post<Holiday, { date: string; name: string }>('/frontdesk/holidays/', payload),
  deactivateHoliday: (id: number): Promise<void> => del(`/frontdesk/holidays/${id}/`),
}
