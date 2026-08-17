import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useBusinessProfile, usePublicBusinessProfile } from '@/features/config/hooks'
import { setFavicon } from '@/lib/favicon'
import { configureFormatting } from '@/lib/format'

export function BrandSync(): null {
  const queryClient = useQueryClient()
  const profile = useBusinessProfile()
  const publicProfile = usePublicBusinessProfile()

  const source = profile.data ?? publicProfile.data
  const logoUrl = source?.logo_url ?? null
  const locale = source?.locale
  const currency = source?.currency

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

  return null
}
