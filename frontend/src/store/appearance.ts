import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type ThemePreference = ThemeMode | 'motel'
export type DensityPreference = Density | 'motel'

export interface MotelAppearance {
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

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'motel',
      density: 'motel',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'motel-erp-appearance',
      version: 3,
      migrate: () => ({ theme: 'motel', density: 'motel' }),
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

export function applyAppearance(
  themePreference: ThemePreference,
  densityPreference: DensityPreference,
  motel: MotelAppearance,
): void {
  const root = document.documentElement
  const theme = themePreference === 'motel' ? motel.default_theme : themePreference
  const density = densityPreference === 'motel' ? motel.default_density : densityPreference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark))

  const primary = hexToHsl(motel.brand_primary_color)
  const sidebar = hexToHsl(motel.brand_sidebar_color)
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-foreground', readableForeground(motel.brand_primary_color))
  root.style.setProperty('--ring', primary)
  root.style.setProperty('--brand-accent', primary)
  root.style.setProperty('--sidebar', sidebar)
  root.style.setProperty('--sidebar-foreground', readableForeground(motel.brand_sidebar_color))
  root.style.setProperty('--sidebar-accent', sidebar)
  root.style.setProperty(
    '--sidebar-accent-foreground',
    readableForeground(motel.brand_sidebar_color),
  )
  root.style.setProperty('--sidebar-border', sidebar)
  root.style.setProperty('--sidebar-ring', primary)
  root.style.setProperty('--status-available', hexToHsl(motel.status_available_color))
  root.style.setProperty('--status-occupied', hexToHsl(motel.status_occupied_color))
  root.style.setProperty('--status-cleaning', hexToHsl(motel.status_cleaning_color))
  root.style.setProperty('--status-maintenance', hexToHsl(motel.status_maintenance_color))

  const radii = { square: '0.125rem', medium: '0.625rem', rounded: '1rem' }
  const fonts = {
    modern: 'Inter var, Inter, ui-sans-serif, system-ui, sans-serif',
    system: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
    rounded: 'Nunito, Inter var, ui-rounded, system-ui, sans-serif',
  }
  root.style.setProperty('--radius', radii[motel.border_radius])
  root.style.setProperty('--font-sans', fonts[motel.font_family])
  root.dataset.density = density
}
