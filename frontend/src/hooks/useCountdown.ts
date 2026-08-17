/**
 * Cuenta regresiva de una renta.
 *
 * El único dato de verdad es `expires_at`, que viene del servidor. Aquí solo
 * se pinta el descuento segundo a segundo, corregido con el desfase de reloj:
 * el cliente jamás decide cuándo vence un cuarto.
 */

import { useEffect, useState } from 'react'

import { secondsUntil } from '@/lib/serverTime'

export type CountdownLevel = 'normal' | 'warning' | 'expired'

export interface Countdown {
  seconds: number
  level: CountdownLevel
  isExpired: boolean
}

interface Options {
  /** Minutos antes del vencimiento en que la tarjeta pasa a amarillo. */
  warningMinutes?: number
  intervalMs?: number
}

export function useCountdown(expiresAt: string | null | undefined, options: Options = {}): Countdown {
  const { warningMinutes = 15, intervalMs = 1000 } = options
  const [seconds, setSeconds] = useState<number>(() =>
    expiresAt ? secondsUntil(expiresAt) : 0,
  )

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(0)
      return
    }

    setSeconds(secondsUntil(expiresAt))
    const timer = window.setInterval(() => setSeconds(secondsUntil(expiresAt)), intervalMs)
    return () => window.clearInterval(timer)
  }, [expiresAt, intervalMs])

  const level: CountdownLevel =
    seconds <= 0 ? 'expired' : seconds <= warningMinutes * 60 ? 'warning' : 'normal'

  return { seconds, level, isExpired: seconds <= 0 }
}
