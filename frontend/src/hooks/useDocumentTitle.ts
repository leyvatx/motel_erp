import { useEffect } from 'react'

import { useBrand } from '@/features/config/hooks'

const FALLBACK_NAME = 'Motel ERP'

export function useDocumentTitle(section?: string): void {
  const { name } = useBrand()

  useEffect(() => {
    const negocio = name || FALLBACK_NAME
    document.title = section ? `${section} · ${negocio}` : negocio
  }, [section, name])
}
