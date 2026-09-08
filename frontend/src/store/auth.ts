import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { migrateStorageKey } from '@/lib/storage'
import type { LoginResponse, Role, User } from '@/types/api'

migrateStorageKey('motel-erp-auth', 'erp-auth')

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
      clearActiveMotel: () => set({ activeMotelId: null, activeMotelName: null, activeRole: null }),
      // `motelSlug` también, y no es un detalle: es la única pista que queda
      // de a qué negocio se entró, y la consulta pública de la marca la usa
      // para volver a pedir su nombre, su logotipo y sus colores. Dejarla
      // puesta hacía que cerrar sesión no borrara la sucursal de la pantalla.
      clear: () =>
        set({
          user: null,
          access: null,
          refresh: null,
          motelSlug: null,
          activeMotelId: null,
          activeMotelName: null,
          activeRole: null,
        }),
    }),
    { name: 'erp-auth' },
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

/** Quién puede tocar catálogos, tarifas y configuración del negocio.
 *
 *  Espeja `CONFIG_MANAGE` del servidor, que es quien de verdad decide: esto
 *  solo evita ofrecer un botón que va a terminar en 403. Recepción cobra y
 *  renta, pero no da de alta productos ni cambia tarifas; si eso cambia,
 *  cambia primero en `ROLE_PERMISSIONS` del backend y después aquí.
 *
 *  Vivía copiado en tres pantallas con tres nombres distintos. */
export function canManageCatalog(user: User | null | undefined): boolean {
  if (!user) return false
  const role = user.is_corporate_user ? useAuthStore.getState().activeRole : user.role
  return role === 'SUPERADMIN' || role === 'MANAGER'
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

/** Dónde aterriza cada quien al entrar.
 *
 *  El tablero es la pantalla de quien supervisa: resume el turno, la ocupación
 *  y lo que necesita atención. Para quien opera es una escala de más: una
 *  recepcionista entra a rentar cuartos y una camarista a ver su lista, y a los
 *  dos les tocaba pasar por un resumen que no van a leer antes de llegar a su
 *  trabajo. Aquí cada rol cae directo en su herramienta; el tablero sigue en el
 *  menú para quien lo quiera.
 */
const RUTA_INICIAL: Record<Role, string> = {
  SUPERADMIN: '/dashboard',
  MANAGER: '/dashboard',
  RECEPTION: '/frontdesk',
  HOUSEKEEPING: '/housekeeping',
}

export function defaultRouteFor(user: User | null | undefined): string {
  if (user?.is_platform_admin) return '/platform'
  if (user?.is_corporate_user) {
    const { activeRole } = useAuthStore.getState()
    return activeRole ? RUTA_INICIAL[activeRole] : '/corporate'
  }
  return user ? RUTA_INICIAL[user.role] : '/dashboard'
}
