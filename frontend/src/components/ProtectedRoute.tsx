import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { canAccessSection, useAuthStore } from '@/store/auth'

interface Props {
  children: ReactNode
  section?: string
}

/** Lo que se pinta mientras la sesión existe pero el perfil todavía no.
 *
 *  Sin esto, `canAccessSection` recibe un usuario nulo, contesta que no y el
 *  usuario sale disparado a "sin acceso" por unos milisegundos de hidratación.
 *  Un esqueleto sobrio dice lo mismo que la pantalla que viene -- encabezado y
 *  cuerpo -- y no mueve a nadie de sitio. */
function Resolviendo() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Validando la sesión</span>
    </div>
  )
}

export function ProtectedRoute({ children, section }: Props) {
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!access) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Con token pero sin perfil la sesión no es inválida, solo está a medio
  // resolver: `useCurrentUser` la está pidiendo. Expulsar aquí es el rebote que
  // hace ver la aplicación rota justo después de entrar.
  if (!user) {
    return <Resolviendo />
  }

  if (section && !canAccessSection(user, section)) {
    return <Navigate to="/sin-acceso" replace />
  }

  return <>{children}</>
}
