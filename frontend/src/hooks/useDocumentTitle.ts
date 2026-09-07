import { useEffect } from 'react'

import { useBrand } from '@/features/config/hooks'
import { APP_FALLBACK_NAME } from '@/lib/brand'

export function useDocumentTitle(section?: string): void {
  const { name } = useBrand()

  useEffect(() => {
    const negocio = name || APP_FALLBACK_NAME
    document.title = section ? `${section} · ${negocio}` : negocio
  }, [section, name])
}
