import { useSyncExternalStore } from 'react'

import { instanteActual, suscribirReloj } from '@/lib/clock'

export type CountdownLevel = 'normal' | 'warning' | 'expired'

export interface Countdown {
  seconds: number
  level: CountdownLevel
  isExpired: boolean
}

interface Options {
  warningMinutes?: number
}

/** Cuenta regresiva contra el reloj del servidor.
 *
 *  No tiene temporizador propio: se cuelga del latido compartido
 *  (`@/lib/clock`), así que veinte tarjetas cuestan un `setInterval`, no
 *  veinte, y todas marcan exactamente el mismo segundo. */
export function useCountdown(
  expiresAt: string | null | undefined,
  options: Options = {},
): Countdown {
  const { warningMinutes = 15 } = options
  const ahora = useSyncExternalStore(suscribirReloj, instanteActual, instanteActual)

  const seconds = expiresAt ? Math.round((new Date(expiresAt).getTime() - ahora) / 1000) : 0

  const level: CountdownLevel =
    seconds <= 0 ? 'expired' : seconds <= warningMinutes * 60 ? 'warning' : 'normal'

  return { seconds, level, isExpired: seconds <= 0 }
}

/** La hora de operación, viva, para quien quiera pintarla. */
export function useServerClock(): number {
  return useSyncExternalStore(suscribirReloj, instanteActual, instanteActual)
}
