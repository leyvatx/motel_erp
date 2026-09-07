import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useCurrentUser, useLogout } from '@/features/auth/hooks'
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
    <div className="space-y-4 p-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Validando la sesión</span>
    </div>
  )
}

/** Sesión sin salida: el token existe pero el perfil no llega.
 *
 *  Pasaba con la red caída, con el servidor despertando o con un refresh que
 *  ya no vale. Antes esto era una espera infinita; ahora es una pantalla con
 *  las dos únicas salidas que sirven. */
function SesionAtorada({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const logout = useLogout()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <ErrorState
        title="No pudimos confirmar tu sesión"
        description="Tu acceso sigue guardado, pero el servidor no contestó quién eres. Reintenta; si sigue igual, vuelve a entrar."
        onRetry={onRetry}
        retrying={retrying}
        secondaryAction={
          <Button variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>
            Salir y entrar de nuevo
          </Button>
        }
      />
    </div>
  )
}

/**
 * La sesión tiene tres estados y esta puerta los distingue explícitamente:
 *
 *     sin token         -> a la pantalla de acceso
 *     token sin perfil  -> resolviendo (o atorada, si `/auth/me` falló)
 *     token con perfil  -> adentro, con o sin permiso para la sección
 *
 * `useCurrentUser` se pide **aquí**, no en `AppLayout`. Vivía allí y eso creaba
 * un candado: sin perfil esta puerta no montaba el layout, y sin layout nadie
 * pedía el perfil. Quien entraba con la red lenta -- o volvía con la sesión a
 * medio hidratar -- se quedaba en "Validando..." para siempre, sin botón que
 * tocar. Pedirlo en la misma puerta que lo exige cierra el ciclo: la petición
 * sale siempre que haya token, exista o no la pantalla de abajo.
 */
export function ProtectedRoute({ children, section }: Props) {
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  // La consulta está deduplicada por clave: que esta puerta esté anidada
  // (layout + sección) no dispara dos llamadas a /auth/me.
  const sesion = useCurrentUser()

  if (!access) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (!user) {
    if (sesion.isError) {
      return <SesionAtorada onRetry={() => void sesion.refetch()} retrying={sesion.isFetching} />
    }
    return <Resolviendo />
  }

  if (section && !canAccessSection(user, section)) {
    return <Navigate to="/sin-acceso" replace />
  }

  return <>{children}</>
}
