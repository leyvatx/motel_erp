import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useBrand } from '@/features/config/hooks'
import { nombreDelProducto } from '@/lib/brand'

/** El título de la pestaña: la sección y de quién es la pantalla.
 *
 *  Depende del idioma en dos puntos -- el nombre del producto cuando no hay
 *  negocio, y la sección -- así que el efecto se rehace cuando cambia. Sin la
 *  dependencia, la pestaña se quedaba en español dentro de una pantalla que ya
 *  estaba en inglés. */
export function useDocumentTitle(section?: string): void {
  const { name } = useBrand()
  const { i18n } = useTranslation()

  useEffect(() => {
    const negocio = name || nombreDelProducto()
    document.title = section ? `${section} · ${negocio}` : negocio
  }, [section, name, i18n.resolvedLanguage])
}
