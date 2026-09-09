import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useBusinessProfile, usePublicBusinessProfile } from '@/features/config/hooks'
import { setFavicon } from '@/lib/favicon'
import { configureFormatting } from '@/lib/format'
import {
  APARIENCIA_NEUTRA,
  applyAppearance,
  temaParaInvitado,
  useAlcanceDeMarca,
  useAppearanceStore,
} from '@/store/appearance'

export function BrandSync(): null {
  const queryClient = useQueryClient()
  const profile = useBusinessProfile()
  const publicProfile = usePublicBusinessProfile()

  /* En la portada pública no manda ningún negocio.
   *
   *  La ve gente que todavía no es cliente de nadie, y estaba saliendo con el
   *  color y el ícono del último motel que se abrió en ese navegador. Aquí se
   *  ignora el perfil venga de donde venga: no se filtra por qué consulta trajo
   *  el dato, se corta el dato entero. */
  const neutra = useAlcanceDeMarca((estado) => estado.neutra)

  const negocio = profile.data ?? publicProfile.data
  const source = neutra ? undefined : negocio
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
    const appearance = source ?? APARIENCIA_NEUTRA
    // La portada ignora los colores del negocio, pero no el claro/oscuro de
    // quien mira: eso es suyo, no del inquilino. Sin negocio que lo dicte,
    // `business` pasa a seguir al sistema operativo.
    const preferencia = neutra ? temaParaInvitado(theme) : theme
    const aplicar = (): void => applyAppearance(preferencia, density, appearance, !neutra)

    aplicar()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', aplicar)
    return () => media.removeEventListener('change', aplicar)
  }, [source, theme, density, neutra])

  return null
}
