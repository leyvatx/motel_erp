import { get, post } from '@/lib/axios'
import type { ListParams, PaginatedResponse } from '@/types/api'
import type {
  CreateOrderPayload,
  Folio,
  Order,
  PaymentPayload,
  TicketPreview,
} from '@/features/sales/types'

export const salesApi = {
  folio: (id: number): Promise<Folio> => get<Folio>(`/sales/folios/${id}/`),

  folios: (params?: ListParams & { status?: string }): Promise<PaginatedResponse<Folio>> =>
    get<PaginatedResponse<Folio>>('/sales/folios/', { params }),

  openFolios: (): Promise<PaginatedResponse<Folio>> =>
    get<PaginatedResponse<Folio>>('/sales/folios/open/'),

  openCounter: (notes?: string): Promise<Folio> =>
    post<Folio, { notes?: string }>('/sales/folios/open-counter/', { notes }),

  addCharge: (
    folioId: number,
    payload: { charge_type: string; description: string; unit_price: string; quantity?: string },
  ): Promise<Folio> => post<Folio, typeof payload>(`/sales/folios/${folioId}/charges/`, payload),

  discount: (folioId: number, amount: string, reason: string): Promise<Folio> =>
    post<Folio, { amount: string; reason: string }>(`/sales/folios/${folioId}/discount/`, {
      amount,
      reason,
    }),

  payment: (folioId: number, payload: PaymentPayload): Promise<Folio> =>
    post<Folio, PaymentPayload>(`/sales/folios/${folioId}/payment/`, payload),

  close: (folioId: number): Promise<Folio> => post<Folio>(`/sales/folios/${folioId}/close/`),

  cancel: (folioId: number, reason: string): Promise<Folio> =>
    post<Folio, { reason: string }>(`/sales/folios/${folioId}/cancel/`, { reason }),

  printTicket: (folioId: number): Promise<TicketPreview> =>
    post<TicketPreview>(`/sales/folios/${folioId}/print-ticket/`),

  createOrder: (payload: CreateOrderPayload): Promise<Order> =>
    post<Order, CreateOrderPayload>('/sales/orders/', payload),

  cancelOrder: (orderId: number, reason: string): Promise<Order> =>
    post<Order, { reason: string }>(`/sales/orders/${orderId}/cancel/`, { reason }),
}
