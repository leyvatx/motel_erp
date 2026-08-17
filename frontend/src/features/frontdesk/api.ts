import { get, post } from '@/lib/axios'
import type { ListParams, PaginatedResponse } from '@/types/api'
import type {
  CheckoutPayload,
  ExtendStayPayload,
  RentRoomPayload,
  Reservation,
  Room,
  RoomGridItem,
  RoomStatusSummary,
  RoomType,
  Stay,
  StayListItem,
  TariffBlock,
} from '@/features/frontdesk/types'

export interface GridParams extends ListParams {
  status?: string
  room_type?: number
}

export const frontdeskApi = {
  grid: (params?: GridParams): Promise<PaginatedResponse<RoomGridItem>> =>
    get<PaginatedResponse<RoomGridItem>>('/frontdesk/rooms/grid/', {
      params: { page_size: 200, ...params },
    }),

  summary: (): Promise<RoomStatusSummary[]> =>
    get<RoomStatusSummary[]>('/frontdesk/rooms/summary/'),

  rooms: (params?: ListParams): Promise<PaginatedResponse<Room>> =>
    get<PaginatedResponse<Room>>('/frontdesk/rooms/', { params }),

  roomTypes: (): Promise<PaginatedResponse<RoomType>> =>
    get<PaginatedResponse<RoomType>>('/frontdesk/room-types/', { params: { page_size: 100 } }),

  tariffBlocks: (roomType?: number): Promise<PaginatedResponse<TariffBlock>> =>
    get<PaginatedResponse<TariffBlock>>('/frontdesk/tariff-blocks/', {
      params: { room_type: roomType, is_active: true, page_size: 100 },
    }),

  finishCleaning: (roomId: number): Promise<Room> =>
    post<Room>(`/frontdesk/rooms/${roomId}/finish-cleaning/`),

  outOfService: (roomId: number, reason: string, blocked = false): Promise<Room> =>
    post<Room, { reason: string; blocked: boolean }>(
      `/frontdesk/rooms/${roomId}/out-of-service/`,
      { reason, blocked },
    ),

  stays: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<StayListItem>> =>
    get<PaginatedResponse<StayListItem>>('/frontdesk/stays/', { params }),

  stay: (id: number): Promise<Stay> => get<Stay>(`/frontdesk/stays/${id}/`),

  expiring: (): Promise<PaginatedResponse<StayListItem>> =>
    get<PaginatedResponse<StayListItem>>('/frontdesk/stays/expiring/'),

  rent: (payload: RentRoomPayload): Promise<Stay> =>
    post<Stay, RentRoomPayload>('/frontdesk/stays/rent/', payload),

  extend: (stayId: number, payload: ExtendStayPayload): Promise<Stay> =>
    post<Stay, ExtendStayPayload>(`/frontdesk/stays/${stayId}/extend/`, payload),

  checkout: (stayId: number, payload: CheckoutPayload): Promise<Stay> =>
    post<Stay, CheckoutPayload>(`/frontdesk/stays/${stayId}/checkout/`, payload),

  cancelStay: (stayId: number, reason: string): Promise<Stay> =>
    post<Stay, { reason: string }>(`/frontdesk/stays/${stayId}/cancel/`, { reason }),

  reservations: (params?: ListParams): Promise<PaginatedResponse<Reservation>> =>
    get<PaginatedResponse<Reservation>>('/frontdesk/reservations/', { params }),

  cancelReservation: (id: number, reason: string): Promise<Reservation> =>
    post<Reservation, { reason: string }>(`/frontdesk/reservations/${id}/cancel/`, { reason }),
}
