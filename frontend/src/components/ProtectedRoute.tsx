import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { canAccessSection, useAuthStore } from '@/store/auth'

interface Props {
  children: ReactNode
  /** Seccion del menu que protege esta ruta. */
  section?: string
}

/**
 * Puerta de acceso del cliente.
 *
 * Es solo comodidad de navegacion: la autorización real la impone la API con
 * la matriz de permisos. Aquí únicamente se evita mostrar pantallas que el
 * rol no podría usar.
 */
export function ProtectedRoute({ children, section }: Props) {
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!access) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (section && !canAccessSection(user?.role, section)) {
    return <Navigate to="/sin-acceso" replace />
  }

  return <>{children}</>
}
