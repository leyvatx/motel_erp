/**
 * Apariencia del sistema: tema, color de acento y logotipo.
 *
 * Se guarda en el navegador del equipo. Cada computadora de recepción puede
 * tener su propio tema (la de la caseta nocturna suele preferir oscuro), pero
 * el logotipo se captura una vez por equipo; moverlo al servidor es el
 * siguiente paso natural si se quiere compartir entre todas las terminales.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AccentPreset {
  id: string
  label: string
  /** Valor HSL sin la función, tal como lo consumen las variables CSS. */
  hsl: string
}

export const ACCENTS: readonly AccentPreset[] = [
  { id: 'blue', label: 'Azul', hsl: '217 91% 60%' },
  { id: 'emerald', label: 'Esmeralda', hsl: '160 84% 39%' },
  { id: 'violet', label: 'Violeta', hsl: '262 83% 58%' },
  { id: 'amber', label: 'Ámbar', hsl: '35 92% 50%' },
  { id: 'rose', label: 'Rosa', hsl: '346 77% 50%' },
  { id: 'slate', label: 'Grafito', hsl: '215 25% 27%' },
]

export type ThemeMode = 'light' | 'dark' | 'system'

interface AppearanceState {
  theme: ThemeMode
  accentId: string
  logo: string | null
  businessName: string
  setTheme: (theme: ThemeMode) => void
  setAccent: (accentId: string) => void
  setLogo: (logo: string | null) => void
  setBusinessName: (name: string) => void
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'light',
      accentId: 'blue',
      logo: null,
      businessName: 'Motel ERP',
      setTheme: (theme) => set({ theme }),
      setAccent: (accentId) => set({ accentId }),
      setLogo: (logo) => set({ logo }),
      setBusinessName: (businessName) => set({ businessName }),
    }),
    { name: 'motel-erp-appearance' },
  ),
)

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0]!
}

/** Aplica tema y acento sobre las variables CSS del documento. */
export function applyAppearance(theme: ThemeMode, accentId: string): void {
  const root = document.documentElement

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)

  const accent = accentById(accentId)
  root.style.setProperty('--primary', accent.hsl)
  root.style.setProperty('--ring', accent.hsl)
  root.style.setProperty('--brand-accent', accent.hsl)
  root.style.setProperty('--sidebar-ring', accent.hsl)
}
