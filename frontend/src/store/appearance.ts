import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { migrateStorageKey } from '@/lib/storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type ThemePreference = ThemeMode | 'business'
export type DensityPreference = Density | 'business'

export interface BusinessAppearance {
  brand_primary_color: string
  brand_sidebar_color: string
  status_available_color: string
  status_occupied_color: string
  status_cleaning_color: string
  status_maintenance_color: string
  default_theme: ThemeMode
  default_density: Density
  border_radius: 'square' | 'medium' | 'rounded'
  font_family: 'modern' | 'system' | 'rounded'
}

interface AppearanceState {
  theme: ThemePreference
  density: DensityPreference
  setTheme: (theme: ThemePreference) => void
  setDensity: (density: DensityPreference) => void
}

migrateStorageKey('motel-erp-appearance', 'erp-appearance')

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'business',
      density: 'business',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'erp-appearance',
      version: 4,
      migrate: () => ({ theme: 'business', density: 'business' }),
    },
  ),
)

function hexToHsl(hex: string): string {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  let hue = 0
  let saturation = 0
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  if (hue < 0) hue += 360
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`
}

function readableForeground(hex: string): string {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '240 10% 4%' : '0 0% 98%'
}

/** Lo que el arranque en frío necesita saber antes de pintar el primer pixel.
 *
 *  Se guarda ya resuelto -- variables CSS calculadas, no colores en hex ni
 *  preferencias que haya que interpretar -- para que el guion en línea de
 *  `index.html` pueda aplicarlo sin cargar nada de esto. Ese guion corre antes
 *  del primer pintado; si tuviera que esperar a React, el usuario vería la
 *  aplicación en claro y después el salto a oscuro, en cada recarga. */
export const CLAVE_TEMA_PREPINTADO = 'erp-tema-resuelto'

export interface TemaResuelto {
  dark: boolean
  density: Density
  vars: Record<string, string>
}

export function applyAppearance(
  themePreference: ThemePreference,
  densityPreference: DensityPreference,
  negocio: BusinessAppearance,
): void {
  const root = document.documentElement
  const theme = themePreference === 'business' ? negocio.default_theme : themePreference
  const density = densityPreference === 'business' ? negocio.default_density : densityPreference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)

  const primary = hexToHsl(negocio.brand_primary_color)
  const radii = { square: '0.125rem', medium: '0.375rem', rounded: '0.75rem' }

  const vars: Record<string, string> = {
    '--primary': primary,
    '--primary-foreground': readableForeground(negocio.brand_primary_color),
    '--brand-accent': primary,
    '--ring': primary,
    '--status-available': hexToHsl(negocio.status_available_color),
    '--status-occupied': hexToHsl(negocio.status_occupied_color),
    '--status-cleaning': hexToHsl(negocio.status_cleaning_color),
    '--status-maintenance': hexToHsl(negocio.status_maintenance_color),
    '--radius': radii[negocio.border_radius],
  }

  root.classList.toggle('dark', dark)
  for (const [nombre, valor] of Object.entries(vars)) root.style.setProperty(nombre, valor)
  root.dataset.density = density

  const resuelto: TemaResuelto = { dark, density, vars }
  try {
    localStorage.setItem(CLAVE_TEMA_PREPINTADO, JSON.stringify(resuelto))
  } catch {
    // Modo privado o almacenamiento lleno: se pierde el pre-pintado del
    // siguiente arranque, no la apariencia de esta sesión.
  }
}
