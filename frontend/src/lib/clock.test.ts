import { afterEach, describe, expect, it, vi } from 'vitest'

import { instanteActual, suscribirReloj } from '@/lib/clock'
import { syncServerTime } from '@/lib/serverTime'

describe('reloj compartido', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // La razón de existir del módulo: cuarenta tarjetas en el tablero de
  // recepción no pueden ser cuarenta `setInterval`. Si alguien vuelve a
  // ponerle un temporizador por consumidor, esta cuenta lo delata.
  it('un solo temporizador aunque haya muchos consumidores', () => {
    vi.useFakeTimers()
    const crear = vi.spyOn(window, 'setInterval')
    const limpiar = vi.spyOn(window, 'clearInterval')

    const bajas = Array.from({ length: 20 }, () => suscribirReloj(() => undefined))
    expect(crear).toHaveBeenCalledTimes(1)

    // Y se apaga solo cuando el último se va: una pestaña en Caja no tiene por
    // qué seguir latiendo.
    const ultima = bajas.pop() as () => void
    bajas.forEach((baja) => baja())
    expect(limpiar).not.toHaveBeenCalled()

    ultima()
    expect(limpiar).toHaveBeenCalledTimes(1)
  })

  it('avisa a todos con el mismo instante', () => {
    vi.useFakeTimers()
    const vistos: number[] = []
    const bajas = [
      suscribirReloj(() => vistos.push(instanteActual())),
      suscribirReloj(() => vistos.push(instanteActual())),
    ]

    vi.advanceTimersByTime(1000)

    expect(vistos).toHaveLength(2)
    expect(vistos[0]).toBe(vistos[1])

    bajas.forEach((baja) => baja())
  })

  it('marca la hora del servidor, no la del equipo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'))

    // La terminal del mostrador va cinco minutos atrasada.
    syncServerTime('2026-09-07T12:05:00Z')

    const baja = suscribirReloj(() => undefined)
    try {
      vi.advanceTimersByTime(1000)
      expect(instanteActual()).toBe(new Date('2026-09-07T12:05:01Z').getTime())
    } finally {
      baja()
      syncServerTime(new Date())
    }
  })
})
