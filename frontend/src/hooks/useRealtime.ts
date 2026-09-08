import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { teamKeys } from '@/features/users/presence'
import { queryKeys } from '@/lib/queryClient'
import { frontdeskChannel, notificationChannel, realtimeChannels } from '@/lib/websocket'
import { useAuthStore } from '@/store/auth'
import { RealtimeEvent } from '@/types/realtime'
import type { ConnectionState, RealtimeMessage } from '@/types/realtime'

type QueryKeyList = readonly (readonly unknown[])[]

const INVALIDATION_MAP: Record<string, QueryKeyList> = {
  [RealtimeEvent.RoomStatusChanged]: [
    queryKeys.frontdesk.grid,
    queryKeys.frontdesk.summary,
    queryKeys.housekeeping.board(),
  ],
  [RealtimeEvent.StayStarted]: [
    queryKeys.frontdesk.grid,
    queryKeys.frontdesk.summary,
    queryKeys.frontdesk.expiring,
  ],
  [RealtimeEvent.StayExtended]: [queryKeys.frontdesk.grid, queryKeys.frontdesk.expiring],
  [RealtimeEvent.StayClosed]: [
    queryKeys.frontdesk.grid,
    queryKeys.frontdesk.summary,
    queryKeys.frontdesk.expiring,
    queryKeys.housekeeping.board(),
    queryKeys.finances.currentShift,
  ],
  [RealtimeEvent.StayCancelled]: [queryKeys.frontdesk.grid, queryKeys.frontdesk.summary],
  [RealtimeEvent.StayExpiring]: [queryKeys.frontdesk.expiring, queryKeys.frontdesk.grid],
  [RealtimeEvent.StayExpired]: [queryKeys.frontdesk.expiring, queryKeys.frontdesk.grid],
  [RealtimeEvent.OrderCreated]: [queryKeys.sales.orders(), queryKeys.frontdesk.grid],
  [RealtimeEvent.OrderDelivered]: [queryKeys.sales.orders()],
  [RealtimeEvent.OrderCancelled]: [queryKeys.sales.orders(), queryKeys.frontdesk.grid],
  [RealtimeEvent.CleaningTask]: [queryKeys.housekeeping.board(), queryKeys.frontdesk.grid],
  [RealtimeEvent.MaintenanceReported]: [queryKeys.housekeeping.maintenance()],
  [RealtimeEvent.StockLow]: [queryKeys.inventory.lowStock, queryKeys.inventory.stocks()],
  [RealtimeEvent.StockExpiring]: [queryKeys.inventory.lots()],
  [RealtimeEvent.NotificationNew]: [
    queryKeys.notifications.unreadCount,
    queryKeys.notifications.list(),
  ],
  [RealtimeEvent.ShiftChanged]: [queryKeys.finances.currentShift, queryKeys.finances.shifts()],
  [RealtimeEvent.PresenceChanged]: [teamKeys.roster],
  [RealtimeEvent.SettingsChanged]: [queryKeys.settings.business],
}

/** Cada cuánto se vuelve a preguntar cuando no hay socket. */
const RELEVO_SIN_SOCKET_MS = 30_000

/** Lo que el socket mantenía al día y no se puede quedar viejo en pantalla. */
const CLAVES_SIN_SOCKET: QueryKeyList = [
  queryKeys.frontdesk.grid,
  queryKeys.frontdesk.summary,
  queryKeys.frontdesk.expiring,
  queryKeys.housekeeping.board(),
  queryKeys.notifications.unreadCount,
]

export function useRealtime(): { state: ConnectionState } {
  const queryClient = useQueryClient()
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const activeMotelId = useAuthStore((state) => state.activeMotelId)
  const [state, setState] = useState<ConnectionState>('idle')

  useEffect(() => {
    if (!access || user?.is_platform_admin || (user?.is_corporate_user && !activeMotelId)) {
      realtimeChannels.forEach((channel) => channel.disconnect())
      setState('idle')
      return
    }

    realtimeChannels.forEach((channel) => channel.connect())
    const unsubscribeState = frontdeskChannel.onStateChange(setState)

    const handle = (message: RealtimeMessage): void => {
      const keys = INVALIDATION_MAP[message.event]
      if (!keys) return
      keys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey })
      })
    }

    const unsubscribeFrontdesk = frontdeskChannel.onMessage(handle)
    const unsubscribeNotifications = notificationChannel.onMessage(handle)

    return () => {
      unsubscribeState()
      unsubscribeFrontdesk()
      unsubscribeNotifications()
    }
  }, [access, activeMotelId, queryClient, user?.is_corporate_user, user?.is_platform_admin])

  /* Sin socket, la pantalla se queda con lo que trajo la última consulta.
   *
   *  Recepción no puede operar con un tablero congelado: si otra terminal renta
   *  el 204, aquí tiene que verse. Mientras el tiempo real esté caído se vuelve
   *  a preguntar cada medio minuto por lo que cambia solo -- el tablero, los
   *  vencimientos, la limpieza, las notificaciones -- que es exactamente lo que
   *  el socket avisaba. Cuesta cuatro peticiones por minuto y evita la peor
   *  forma de error: la que no se ve. */
  useEffect(() => {
    if (state !== 'degradado' || !access) return

    const id = window.setInterval(() => {
      // Solo si la pestaña está a la vista: refrescar un tablero que nadie
      // está mirando es gastar batería y CPU del servidor.
      if (document.visibilityState !== 'visible') return
      CLAVES_SIN_SOCKET.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey })
      })
    }, RELEVO_SIN_SOCKET_MS)

    return () => window.clearInterval(id)
  }, [state, access, queryClient])

  /* Volver a intentarlo cuando algo cambió de verdad.
   *
   *  Rendirse no puede ser para siempre: la red vuelve, el servidor se
   *  despierta, el usuario regresa a la pestaña después de comer. Esos son los
   *  momentos en que sí vale la pena reintentar, y no cada treinta segundos a
   *  ciegas. */
  useEffect(() => {
    if (!access) return

    const reintentar = (): void => {
      if (document.visibilityState !== 'visible') return
      realtimeChannels.forEach((channel) => channel.reintentar())
    }

    window.addEventListener('online', reintentar)
    document.addEventListener('visibilitychange', reintentar)
    return () => {
      window.removeEventListener('online', reintentar)
      document.removeEventListener('visibilitychange', reintentar)
    }
  }, [access])

  const previousAccess = useRef<string | null>(access)
  useEffect(() => {
    if (access && previousAccess.current && previousAccess.current !== access) {
      realtimeChannels.forEach((channel) => channel.refresh())
    }
    previousAccess.current = access
  }, [access])

  useEffect(() => {
    if (access && activeMotelId) realtimeChannels.forEach((channel) => channel.refresh())
  }, [access, activeMotelId])

  return { state }
}

export function useRealtimeEvent<TPayload = unknown>(
  event: string,
  handler: (payload: TPayload) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const listener = (message: RealtimeMessage): void => {
      if (message.event === event) {
        handlerRef.current(message.payload as TPayload)
      }
    }

    const unsubscribers = realtimeChannels.map((channel) => channel.onMessage(listener))
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [event])
}
