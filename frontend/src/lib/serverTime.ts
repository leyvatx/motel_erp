let offsetMs = 0

export function syncServerTime(serverDate: string | number | Date): void {
  const serverMs = new Date(serverDate).getTime()
  if (Number.isNaN(serverMs)) return
  offsetMs = serverMs - Date.now()
}

export function getClockOffset(): number {
  return offsetMs
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

export function secondsUntil(isoDate: string): number {
  return Math.round((new Date(isoDate).getTime() - serverNow()) / 1000)
}
