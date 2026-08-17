/**
 * Puente entre el WebSocket y la cache de TanStack Query.
 *
 * En vez de refrescar por temporizador, cada evento del backend invalida
 * exactamente las consultas que quedaron viejas. El grid de recepción se
 * entera del cambio en el momento en que ocurre.
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { teamKeys } from '@/features/users/presence'
import { queryKeys } from '@/lib/queryClient'
import {
  frontdeskChannel,
  notificationChannel,
  realtimeChannels,
} from '@/lib/websocket'
import { useAuthStore } from '@/store/auth'
import { RealtimeEvent } from '@/types/realtime'
import type { ConnectionState, RealtimeMessage } from '@/types/realtime'

type QueryKeyList = readonly (readonly unknown[])[]

/** Que consultas quedan obsoletas con cada evento. */
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
}

/**
 * Abre los canales mientras haya sesión y mantiene la cache al día.
 * Se monta una sola vez, en el layout principal.
 */
export function useRealtime(): { state: ConnectionState } {
  const queryClient = useQueryClient()
  const access = useAuthStore((state) => state.access)
  const [state, setState] = useState<ConnectionState>('idle')

  useEffect(() => {
    if (!access) {
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
  }, [access, queryClient])

  // El token cambia al renovarse: hay que reabrir con el nuevo.
  const previousAccess = useRef<string | null>(access)
  useEffect(() => {
    if (access && previousAccess.current && previousAccess.current !== access) {
      realtimeChannels.forEach((channel) => channel.refresh())
    }
    previousAccess.current = access
  }, [access])

  return { state }
}

/**
 * Escucha un evento concreto. Sirve para efectos que la invalidacion de
 * cache no cubre: sonar una alarma, mostrar un toast, animar una tarjeta.
 */
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
