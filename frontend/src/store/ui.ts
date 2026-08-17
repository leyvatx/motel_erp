/** Preferencias de interfaz que sobreviven al refresco. */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  soundAlerts: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setSoundAlerts: (enabled: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      soundAlerts: import.meta.env.VITE_ENABLE_SOUND_ALERTS !== 'false',
      theme: 'light',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSoundAlerts: (soundAlerts) => set({ soundAlerts }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'motel-erp-ui' },
  ),
)
