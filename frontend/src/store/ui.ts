import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { migrateStorageKey } from '@/lib/storage'

migrateStorageKey('motel-erp-ui', 'erp-ui')

/** Gestión arranca cerrada: un operador de recepción no entra ahí, y las cuatro
 *  secciones que contiene empujaban la operación diaria hacia abajo. */
const GRUPOS_INICIALES: Record<string, boolean> = { management: false }

interface UiState {
  sidebarCollapsed: boolean
  soundAlerts: boolean
  navGroups: Record<string, boolean>
  setupDismissed: boolean
  /** Módulos cuya ayuda ya se abrió sola una vez en este navegador. */
  ayudaVista: Record<string, boolean>
  toggleSidebar: () => void
  setSoundAlerts: (enabled: boolean) => void
  toggleNavGroup: (id: string) => void
  marcarAyudaVista: (modulo: string) => void
  dismissSetup: () => void
  reopenSetup: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      soundAlerts: import.meta.env.VITE_ENABLE_SOUND_ALERTS !== 'false',
      navGroups: GRUPOS_INICIALES,
      setupDismissed: false,
      ayudaVista: {},
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSoundAlerts: (soundAlerts) => set({ soundAlerts }),
      toggleNavGroup: (id) =>
        set((state) => ({
          navGroups: { ...state.navGroups, [id]: !(state.navGroups[id] ?? true) },
        })),
      marcarAyudaVista: (modulo) =>
        set((state) => ({ ayudaVista: { ...state.ayudaVista, [modulo]: true } })),
      dismissSetup: () => set({ setupDismissed: true }),
      reopenSetup: () => set({ setupDismissed: false }),
    }),
    { name: 'erp-ui' },
  ),
)
