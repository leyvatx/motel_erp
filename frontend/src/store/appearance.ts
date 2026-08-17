import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AccentPreset {
  id: string
  label: string
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
export type Density = 'comfortable' | 'compact'

interface AppearanceState {
  theme: ThemeMode
  accentId: string
  density: Density
  setTheme: (theme: ThemeMode) => void
  setAccent: (accentId: string) => void
  setDensity: (density: Density) => void
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'light',
      accentId: 'blue',
      density: 'comfortable',
      setTheme: (theme) => set({ theme }),
      setAccent: (accentId) => set({ accentId }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'motel-erp-appearance',
      version: 2,
      migrate: (persisted, version) => {
        const previous = (persisted ?? {}) as Partial<AppearanceState>
        if (version >= 2) return previous as AppearanceState
        return {
          theme: previous.theme ?? 'light',
          accentId: previous.accentId ?? 'blue',
          density: 'comfortable',
        } as AppearanceState
      },
    },
  ),
)

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0]!
}

export function applyAppearance(theme: ThemeMode, accentId: string, density: Density): void {
  const root = document.documentElement

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)

  const accent = accentById(accentId)
  root.style.setProperty('--primary', accent.hsl)
  root.style.setProperty('--ring', accent.hsl)
  root.style.setProperty('--brand-accent', accent.hsl)
  root.style.setProperty('--sidebar-ring', accent.hsl)

  root.dataset.density = density
}
