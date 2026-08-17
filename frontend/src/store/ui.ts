import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  soundAlerts: boolean
  toggleSidebar: () => void
  setSoundAlerts: (enabled: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      soundAlerts: import.meta.env.VITE_ENABLE_SOUND_ALERTS !== 'false',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSoundAlerts: (soundAlerts) => set({ soundAlerts }),
    }),
    { name: 'motel-erp-ui' },
  ),
)
