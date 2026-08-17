/**
 * Sesión del usuario.
 *
 * Los tokens se guardan en localStorage para sobrevivir al refresco de la
 * página; el interceptor de axios se encarga de renovarlos.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { LoginResponse, Role, User } from '@/types/api'

interface AuthState {
  user: User | null
  access: string | null
  refresh: string | null
  setSession: (data: LoginResponse) => void
  setAccess: (access: string) => void
  setUser: (user: User) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access: null,
      refresh: null,
      setSession: (data) => set({ user: data.user, access: data.access, refresh: data.refresh }),
      setAccess: (access) => set({ access }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, access: null, refresh: null }),
    }),
    { name: 'motel-erp-auth' },
  ),
)

/** Lectura fuera de React (interceptores de axios, cliente WebSocket). */
export const authSnapshot = {
  access: (): string | null => useAuthStore.getState().access,
  refresh: (): string | null => useAuthStore.getState().refresh,
  user: (): User | null => useAuthStore.getState().user,
}

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().access)
}

/** Matriz de acceso por rol, espejo de la del backend. */
const ROLE_SECTIONS: Record<Role, readonly string[]> = {
  SUPERADMIN: [
    'frontdesk',
    'inventory',
    'housekeeping',
    'finances',
    'reports',
    'audit',
    'users',
    'config',
  ],
  MANAGER: ['frontdesk', 'inventory', 'housekeeping', 'finances', 'reports', 'audit', 'config'],
  RECEPTION: ['frontdesk', 'inventory', 'housekeeping', 'finances'],
  HOUSEKEEPING: ['housekeeping', 'inventory'],
}

export function canAccessSection(role: Role | undefined, section: string): boolean {
  if (!role) return false
  return ROLE_SECTIONS[role].includes(section)
}
