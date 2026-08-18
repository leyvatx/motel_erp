import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useBusinessProfile, usePublicBusinessProfile } from '@/features/config/hooks'
import { setFavicon } from '@/lib/favicon'
import { configureFormatting } from '@/lib/format'
import { applyAppearance, useAppearanceStore, type MotelAppearance } from '@/store/appearance'

const FALLBACK_APPEARANCE: MotelAppearance = {
  brand_primary_color: '#3B82F6',
  brand_sidebar_color: '#0F172A',
  status_available_color: '#10B981',
  status_occupied_color: '#EF4444',
  status_cleaning_color: '#F59E0B',
  status_maintenance_color: '#6B7280',
  default_theme: 'light',
  default_density: 'comfortable',
  border_radius: 'medium',
  font_family: 'modern',
}

export function BrandSync(): null {
  const queryClient = useQueryClient()
  const profile = useBusinessProfile()
  const publicProfile = usePublicBusinessProfile()

  const source = profile.data ?? publicProfile.data
  const logoUrl = source?.logo_url ?? null
  const locale = source?.locale
  const currency = source?.currency
  const theme = useAppearanceStore((state) => state.theme)
  const density = useAppearanceStore((state) => state.density)

  const applied = useRef<string | null>(null)

  useEffect(() => {
    setFavicon(logoUrl)
  }, [logoUrl])

  useEffect(() => {
    if (!locale && !currency) return

    configureFormatting({ locale, currency })

    const key = `${locale}|${currency}`
    if (applied.current && applied.current !== key) {
      void queryClient.invalidateQueries()
    }
    applied.current = key
  }, [locale, currency, queryClient])

  useEffect(() => {
    const appearance = source ?? FALLBACK_APPEARANCE
    applyAppearance(theme, density, appearance)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => applyAppearance(theme, density, appearance)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [source, theme, density])

  return null
}
