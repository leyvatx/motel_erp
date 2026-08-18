import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyAppearance, type MotelAppearance } from '@/store/appearance'

const motel: MotelAppearance = {
  brand_primary_color: '#7C3AED',
  brand_sidebar_color: '#111827',
  status_available_color: '#22C55E',
  status_occupied_color: '#DC2626',
  status_cleaning_color: '#F59E0B',
  status_maintenance_color: '#64748B',
  default_theme: 'dark',
  default_density: 'compact',
  border_radius: 'rounded',
  font_family: 'system',
}

describe('personalización por motel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
  })

  it('aplica la identidad y los valores predeterminados del motel', () => {
    applyAppearance('motel', 'motel', motel)

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.dataset.density).toBe('compact')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('262 83% 58%')
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('1rem')
  })

  it('respeta las preferencias locales sin cambiar la paleta', () => {
    applyAppearance('light', 'comfortable', motel)

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.dataset.density).toBe('comfortable')
    expect(document.documentElement.style.getPropertyValue('--status-available')).toBe(
      '142 71% 45%',
    )
  })
})
