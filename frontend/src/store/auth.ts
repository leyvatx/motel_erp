import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { LoginResponse, Role, User } from '@/types/api'

interface AuthState {
  user: User | null
  access: string | null
  refresh: string | null
  motelSlug: string | null
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
      motelSlug: null,
      setSession: (data) =>
        set({
          user: data.user,
          access: data.access,
          refresh: data.refresh,
          motelSlug: data.user.motel_slug,
        }),
      setAccess: (access) => set({ access }),
      setUser: (user) => set({ user, motelSlug: user.motel_slug }),
      clear: () => set({ user: null, access: null, refresh: null }),
    }),
    { name: 'motel-erp-auth' },
  ),
)

export const authSnapshot = {
  access: (): string | null => useAuthStore.getState().access,
  refresh: (): string | null => useAuthStore.getState().refresh,
  user: (): User | null => useAuthStore.getState().user,
}

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().access)
}

export function isPlatformAdmin(user: User | null | undefined): boolean {
  return Boolean(user?.is_platform_admin)
}

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
