import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RoomCard } from '@/features/frontdesk/components/RoomCard'
import type { GridStay, RoomGridItem } from '@/features/frontdesk/types'
import type { RoomStatus } from '@/types/api'

const AHORA = new Date('2026-09-07T12:00:00Z').getTime()

function stay(overrides: Partial<GridStay> = {}): GridStay {
  return {
    id: 7,
    code: 'R-1',
    // Entró hace una hora, sale en tres: la renta va al 25 %.
    check_in_at: new Date(AHORA - 60 * 60_000).toISOString(),
    expires_at: new Date(AHORA + 3 * 60 * 60_000).toISOString(),
    remaining_seconds: 3 * 3600,
    is_expired: false,
    occupants: 2,
    guest_name: '',
    vehicle_plate: '',
    tariff_block_name: '4 horas',
    folio_id: 1,
    folio_total: '350.00',
    folio_balance: '350.00',
    ...overrides,
  }
}

function room(status: RoomStatus, current: GridStay | null = null): RoomGridItem {
  return {
    id: 1,
    number: '101',
    floor: 1,
    zone: '',
    room_type: 1,
    room_type_name: 'Sencilla',
    status,
    status_display: status,
    status_changed_at: new Date(AHORA).toISOString(),
    out_of_service_reason: '',
    current_stay: current,
  }
}

function pintar(item: RoomGridItem, handlers: Partial<Record<string, () => void>> = {}) {
  const noop = (): void => undefined
  return render(
    <RoomCard
      room={item}
      onSelect={handlers.onSelect ?? noop}
      onRent={handlers.onRent ?? noop}
      onCheckout={handlers.onCheckout ?? noop}
      onRequestCleaning={handlers.onRequestCleaning ?? noop}
      onFinishCleaning={handlers.onFinishCleaning ?? noop}
    />,
  )
}

describe('tarjeta de habitación', () => {
  it('la barra marca el avance de la renta, no el tiempo que falta', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    try {
      pintar(room('OCCUPIED', stay()))

      const barra = screen.getByRole('progressbar')
      expect(barra).toHaveAttribute('aria-valuenow', '25')
    } finally {
      vi.useRealTimers()
    }
  })

  it('una renta vencida llega al 100 y no se pasa', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    try {
      pintar(room('OCCUPIED', stay({ expires_at: new Date(AHORA - 30 * 60_000).toISOString() })))

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    } finally {
      vi.useRealTimers()
    }
  })

  it('muestra un avatar por huésped y resume el excedente', () => {
    pintar(room('OCCUPIED', stay({ occupants: 6 })))

    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByText('6 huéspedes')).toBeInTheDocument()
  })

  it('el cuarto libre renta de un clic sin abrir el diálogo', () => {
    const onRent = vi.fn()
    const onSelect = vi.fn()
    pintar(room('AVAILABLE'), { onRent, onSelect })

    fireEvent.click(screen.getByRole('button', { name: /rentar/i }))

    expect(onRent).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('el cuarto en limpieza se libera de un clic', () => {
    const onFinishCleaning = vi.fn()
    pintar(room('CLEANING'), { onFinishCleaning })

    fireEvent.click(screen.getByRole('button', { name: /limpieza lista/i }))

    expect(onFinishCleaning).toHaveBeenCalledTimes(1)
  })

  it('mantenimiento no ofrece acciones de un clic', () => {
    pintar(room('MAINTENANCE'))

    // Solo queda el botón que abre la tarjeta.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
