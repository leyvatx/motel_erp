import { del, patch, post } from '@/lib/axios'
import type { Room, RoomType, TariffBlock } from '@/features/frontdesk/types'

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
}
