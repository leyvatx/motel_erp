/** Formateo para pantalla: dinero, fechas locales y cuentas regresivas. */

import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

/** Convierte el Decimal serializado de DRF a número para operar en pantalla. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function formatMoney(value: string | number | null | undefined): string {
  return currencyFormatter.format(toNumber(value))
}

export function formatQuantity(value: string | number | null | undefined): string {
  return numberFormatter.format(toNumber(value))
}

/** El backend manda UTC; el navegador lo muestra en hora local. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: es })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return format(parseISO(iso), 'HH:mm', { locale: es })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: es })
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-'
  return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true })
}

/** Segundos a `HH:MM:SS`; antepone `-` cuando el tiempo ya se agoto. */
export function formatCountdown(totalSeconds: number): string {
  const negative = totalSeconds < 0
  const seconds = Math.abs(Math.trunc(totalSeconds))

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (value: number): string => value.toString().padStart(2, '0')

  return `${negative ? '-' : ''}${pad(hours)}:${pad(minutes)}:${pad(rest)}`
}

/** Duración legible para los reportes de limpieza. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return '-'
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}
