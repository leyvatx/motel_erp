import { describe, expect, it } from 'vitest'

import { formatCountdown, formatDuration, formatMoney, toNumber } from '@/lib/format'

describe('formatos operativos', () => {
  it('normaliza importes vacíos o inválidos', () => {
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('invalido')).toBe(0)
    expect(toNumber('125.50')).toBe(125.5)
  })

  it('formatea dinero con dos decimales', () => {
    expect(formatMoney('125.5')).toContain('125.50')
  })

  it('conserva el signo al mostrar un cronómetro vencido', () => {
    expect(formatCountdown(-65)).toBe('-00:01:05')
    expect(formatCountdown(3661)).toBe('01:01:01')
  })

  it('resume duraciones de limpieza', () => {
    expect(formatDuration(59 * 60)).toBe('59 min')
    expect(formatDuration(65 * 60)).toBe('1 h 5 min')
  })
})
