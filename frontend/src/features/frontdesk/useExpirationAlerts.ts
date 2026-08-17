/**
 * Alertas de vencimiento.
 *
 * Quien decide que una renta está por vencer es la tarea periódica de Celery,
 * no el navegador: aquí solo se reacciona al evento que llega por WebSocket.
 * Así todas las computadoras de recepción avisan del mismo cuarto al mismo
 * tiempo, aunque sus relojes no coincidan.
 */

import { useRef } from 'react'

import { toast } from '@/components/ui/toast'
import { useRealtimeEvent } from '@/hooks/useRealtime'
import { playExpiredAlert, playWarningAlert } from '@/lib/sound'
import { useUiStore } from '@/store/ui'
import { RealtimeEvent, type StayEventPayload } from '@/types/realtime'

export function useExpirationAlerts(): void {
  const soundEnabled = useUiStore((state) => state.soundAlerts)
  // Evita repetir el aviso si el backend reenvia el evento tras una reconexion.
  const announced = useRef(new Set<string>())

  useRealtimeEvent<StayEventPayload>(RealtimeEvent.StayExpiring, (payload) => {
    const key = `warning:${payload.stay_id}:${payload.expires_at}`
    if (announced.current.has(key)) return
    announced.current.add(key)

    if (soundEnabled) playWarningAlert()
    toast.warning(
      `Habitación ${payload.room_number ?? ''} por vencer`,
      `Quedan ${Math.max(Math.round(payload.remaining_seconds / 60), 0)} minutos.`,
    )
  })

  useRealtimeEvent<StayEventPayload>(RealtimeEvent.StayExpired, (payload) => {
    const key = `expired:${payload.stay_id}:${payload.expires_at}`
    if (announced.current.has(key)) return
    announced.current.add(key)

    if (soundEnabled) playExpiredAlert()
    toast.error(
      `Habitación ${payload.room_number ?? ''} vencida`,
      'Cobra o extiende el tiempo del huesped.',
    )
  })

  // Una extension limpia los avisos previos de esa renta.
  useRealtimeEvent<StayEventPayload>(RealtimeEvent.StayExtended, (payload) => {
    announced.current.forEach((key) => {
      if (key.includes(`:${payload.stay_id}:`)) announced.current.delete(key)
    })
  })
}
