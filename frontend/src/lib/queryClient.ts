import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Se intenta siempre, aunque el navegador diga que no hay red.
      //
      // Por omisión React Query deja las consultas en `paused` cuando
      // `navigator.onLine` es falso, y las despierta con el evento `online`.
      // Ese evento no siempre llega -- una terminal detrás de un portal
      // cautivo, una red sin salida a internet, o un navegador que
      // sencillamente no lo emite -- y entonces la consulta se queda esperando
      // para siempre: ni datos, ni error, ni forma de reintentar. En una
      // recepción eso es una pantalla muerta a mitad del turno.
      //
      // Intentando siempre, la petición falla rápido y cae en el estado de
      // error, que sí trae botón de reintentar. Los reintentos con espera
      // -- incluido el arranque en frío del servidor -- ya los hace el
      // interceptor de axios, que es donde viven las reglas de idempotencia.
      networkMode: 'always',
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0
          if (status >= 400 && status < 500) return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      // Misma razón: un cobro que se queda en `paused` no avisa de nada. Que
      // falle y se pueda reintentar es preferible a que desaparezca.
      networkMode: 'always',
      retry: false,
    },
  },
})

export const queryKeys = {
  platform: {
    motels: (params?: unknown) => ['platform', 'motels', params ?? {}] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    list: (params?: unknown) => ['users', 'list', params ?? {}] as const,
    roles: ['users', 'roles'] as const,
    roleMatrix: ['users', 'role-matrix'] as const,
    sessions: ['users', 'sessions'] as const,
  },
  frontdesk: {
    grid: ['frontdesk', 'grid'] as const,
    summary: ['frontdesk', 'summary'] as const,
    rooms: (params?: unknown) => ['frontdesk', 'rooms', params ?? {}] as const,
    roomTypes: ['frontdesk', 'room-types'] as const,
    tariffBlocks: (roomType?: number) => ['frontdesk', 'tariff-blocks', roomType ?? 'all'] as const,
    stays: (params?: unknown) => ['frontdesk', 'stays', params ?? {}] as const,
    stay: (id: number) => ['frontdesk', 'stay', id] as const,
    expiring: ['frontdesk', 'stays', 'expiring'] as const,
    reservations: (params?: unknown) => ['frontdesk', 'reservations', params ?? {}] as const,
  },
  sales: {
    folio: (id: number) => ['sales', 'folio', id] as const,
    folios: (params?: unknown) => ['sales', 'folios', params ?? {}] as const,
    openFolios: ['sales', 'folios', 'open'] as const,
    orders: (params?: unknown) => ['sales', 'orders', params ?? {}] as const,
  },
  inventory: {
    products: (params?: unknown) => ['inventory', 'products', params ?? {}] as const,
    sellable: ['inventory', 'products', 'sellable'] as const,
    warehouses: ['inventory', 'warehouses'] as const,
    categories: ['inventory', 'categories'] as const,
    stocks: (params?: unknown) => ['inventory', 'stocks', params ?? {}] as const,
    lowStock: ['inventory', 'stocks', 'low'] as const,
    lots: (params?: unknown) => ['inventory', 'lots', params ?? {}] as const,
    kardex: (params?: unknown) => ['inventory', 'kardex', params ?? {}] as const,
    suppliers: (params?: unknown) => ['inventory', 'suppliers', params ?? {}] as const,
    purchases: (params?: unknown) => ['inventory', 'purchases', params ?? {}] as const,
  },
  housekeeping: {
    board: (mine?: boolean) => ['housekeeping', 'board', mine ?? false] as const,
    tasks: (params?: unknown) => ['housekeeping', 'tasks', params ?? {}] as const,
    performance: (params?: unknown) => ['housekeeping', 'performance', params ?? {}] as const,
    maintenance: (params?: unknown) => ['housekeeping', 'maintenance', params ?? {}] as const,
  },
  finances: {
    currentShift: ['finances', 'shift', 'current'] as const,
    shiftTrend: ['finances', 'shift', 'trend'] as const,
    shifts: (params?: unknown) => ['finances', 'shifts', params ?? {}] as const,
    shift: (id: number) => ['finances', 'shift', id] as const,
    expenses: (params?: unknown) => ['finances', 'expenses', params ?? {}] as const,
    pendingExpenses: ['finances', 'expenses', 'pending'] as const,
  },
  notifications: {
    list: (params?: unknown) => ['notifications', 'list', params ?? {}] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  audit: {
    logs: (params?: unknown) => ['audit', 'logs', params ?? {}] as const,
  },
  settings: {
    business: ['settings', 'business'] as const,
    publicBusiness: ['settings', 'business', 'public'] as const,
    timeZones: ['settings', 'time-zones'] as const,
  },
} as const
