/**
 * Reloj del servidor.
 *
 * Los cronómetros no pueden depender del reloj de la computadora de
 * recepción: si esta atrasada media hora, el cuarto "vence" cuando no debe.
 * Aquí se guarda el desfase entre el reloj local y el del servidor, medido
 * con la cabecera `Date` de cada respuesta y con el `timestamp` de cada
 * evento de WebSocket.
 */

let offsetMs = 0

/** Registra el desfase a partir de una hora informada por el servidor. */
export function syncServerTime(serverDate: string | number | Date): void {
  const serverMs = new Date(serverDate).getTime()
  if (Number.isNaN(serverMs)) return
  offsetMs = serverMs - Date.now()
}

/** Milisegundos de diferencia (servidor menos cliente). */
export function getClockOffset(): number {
  return offsetMs
}

/** "Ahora" según el servidor, en milisegundos. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Segundos que faltan para una fecha del servidor; negativo si ya paso. */
export function secondsUntil(isoDate: string): number {
  return Math.round((new Date(isoDate).getTime() - serverNow()) / 1000)
}
