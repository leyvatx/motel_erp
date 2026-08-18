import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { LoginResponse, Role, User } from '@/types/api'

interface AuthState {
  user: User | null
  access: string | null
  refresh: string | null
  motelSlug: string | null
  activeMotelId: number | null
  activeMotelName: string | null
  activeRole: Role | null
  setSession: (data: LoginResponse) => void
  setAccess: (access: string) => void
  setUser: (user: User) => void
  setActiveMotel: (id: number, name: string, role: Role) => void
  clearActiveMotel: () => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access: null,
      refresh: null,
      motelSlug: null,
      activeMotelId: null,
      activeMotelName: null,
      activeRole: null,
      setSession: (data) =>
        set({
          user: data.user,
          access: data.access,
          refresh: data.refresh,
          motelSlug: data.user.motel_slug,
          activeMotelId: data.user.motel,
          activeMotelName: data.user.motel_name,
          activeRole: data.user.motel ? data.user.role : null,
        }),
      setAccess: (access) => set({ access }),
      setUser: (user) => set({ user, motelSlug: user.motel_slug }),
      setActiveMotel: (id, name, role) =>
        set({ activeMotelId: id, activeMotelName: name, activeRole: role }),
      clearActiveMotel: () =>
        set({ activeMotelId: null, activeMotelName: null, activeRole: null }),
      clear: () => set({
        user: null, access: null, refresh: null,
        activeMotelId: null, activeMotelName: null, activeRole: null,
      }),
    }),
    { name: 'motel-erp-auth' },
  ),
)

export const authSnapshot = {
  access: (): string | null => useAuthStore.getState().access,
  refresh: (): string | null => useAuthStore.getState().refresh,
  user: (): User | null => useAuthStore.getState().user,
  activeMotelId: (): number | null => useAuthStore.getState().activeMotelId,
}

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().access)
}

export function isPlatformAdmin(user: User | null | undefined): boolean {
  return Boolean(user?.is_platform_admin)
}

const ROLE_SECTIONS: Record<Role, readonly string[]> = {
  SUPERADMIN: [
    'dashboard',
    'frontdesk',
    'reservations',
    'inventory',
    'housekeeping',
    'finances',
    'reports',
    'audit',
    'users',
    'config',
  ],
  MANAGER: [
    'dashboard',
    'frontdesk',
    'reservations',
    'inventory',
    'housekeeping',
    'finances',
    'reports',
    'audit',
    'config',
  ],
  RECEPTION: ['dashboard', 'frontdesk', 'reservations', 'inventory', 'housekeeping', 'finances'],
  HOUSEKEEPING: ['dashboard', 'housekeeping', 'inventory'],
}

export function canAccessSection(user: User | null | undefined, section: string): boolean {
  if (!user) return false
  if (user.is_platform_admin) return section === 'platform' || section === 'corporate'
  if (user.is_corporate_user) {
    if (section === 'corporate') return true
    const state = useAuthStore.getState()
    if (!state.activeMotelId || !state.activeRole) return false
    return ROLE_SECTIONS[state.activeRole].includes(section)
  }
  return ROLE_SECTIONS[user.role].includes(section)
}

export function defaultRouteFor(user: User | null | undefined): string {
  if (user?.is_platform_admin) return '/platform'
  if (user?.is_corporate_user) return '/corporate'
  return '/dashboard'
}
