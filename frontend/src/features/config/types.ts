import type { MotelAppearance } from '@/store/appearance'

export type PrinterBackend = 'dummy' | 'network' | 'usb' | 'file'

export interface PublicBusinessProfile extends MotelAppearance {
  name: string
  logo_url: string | null
  currency: string
  locale: string
  time_zone: string
  login_message: string
}

export interface BusinessProfile extends PublicBusinessProfile {
  legal_name: string
  tax_id: string
  address: string
  phone: string
  email: string
  ticket_footer: string
  print_ticket_on_close: boolean
  expiration_warning_minutes: number
  expense_approval_threshold: string
  printer_backend: PrinterBackend
  printer_backend_display: string
  printer_host: string
  printer_port: number
  updated_at: string
}

export type BusinessProfilePayload = Partial<
  Omit<BusinessProfile, 'logo_url' | 'printer_backend_display' | 'updated_at'>
>

export interface TimeZoneOption {
  value: string
  label: string
}

export const PRINTER_BACKENDS: readonly { value: PrinterBackend; label: string }[] = [
  { value: 'dummy', label: 'Sin impresora (solo registra)' },
  { value: 'network', label: 'Impresora de red' },
  { value: 'usb', label: 'Impresora USB' },
  { value: 'file', label: 'Archivo de texto' },
]
