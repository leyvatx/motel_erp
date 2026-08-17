import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

let regional = { locale: 'es-MX', currency: 'MXN' }

let currencyFormatter = buildCurrencyFormatter()
let numberFormatter = buildNumberFormatter()

function buildCurrencyFormatter(): Intl.NumberFormat {
  return new Intl.NumberFormat(regional.locale, {
    style: 'currency',
    currency: regional.currency,
    minimumFractionDigits: 2,
  })
}

function buildNumberFormatter(): Intl.NumberFormat {
  return new Intl.NumberFormat(regional.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export function configureFormatting(options: { locale?: string; currency?: string }): void {
  const locale = options.locale?.trim() || regional.locale
  const currency = options.currency?.trim().toUpperCase() || regional.currency
  if (locale === regional.locale && currency === regional.currency) return

  const anterior = regional
  regional = { locale, currency }
  try {
    currencyFormatter = buildCurrencyFormatter()
    numberFormatter = buildNumberFormatter()
  } catch {
    regional = anterior
    currencyFormatter = buildCurrencyFormatter()
    numberFormatter = buildNumberFormatter()
  }
}

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

export function formatCountdown(totalSeconds: number): string {
  const negative = totalSeconds < 0
  const seconds = Math.abs(Math.trunc(totalSeconds))

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (value: number): string => value.toString().padStart(2, '0')

  return `${negative ? '-' : ''}${pad(hours)}:${pad(minutes)}:${pad(rest)}`
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return '-'
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}
