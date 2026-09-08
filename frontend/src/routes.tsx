import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { registrarNavegador } from '@/lib/navigation'
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/pages/ErrorPages'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const LandingPage = lazy(() => import('@/features/marketing/LandingPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))

/** El acceso se pide de inmediato, sin esperar a que se renderice su ruta.
 *
 *  El problema no era que fuera un trozo aparte, sino que se pedía **en
 *  cascada**: el navegador no descubría que lo necesitaba hasta terminar de
 *  ejecutar el paquete principal. Medido contra el servidor real, el principal
 *  cerraba a los 116 ms y el del acceso no arrancaba hasta los 164 -- y
 *  mientras tanto se pintaba un esqueleto en lugar del formulario. Con el
 *  servicio despertando de su sueño, esos milisegundos son segundos.
 *
 *  Llamar al import aquí arriba lanza la descarga en cuanto se evalúa este
 *  archivo, en paralelo con todo lo demás. Meterlo al paquete principal también
 *  lo arreglaba, pero arrastraba consigo el formulario, el validador y el
 *  diálogo: 95 kB más para todo el mundo, en cada visita, a cambio de un
 *  destello. La descarga anticipada cuesta cero.
 */
const cargarAcceso = () => import('@/features/auth/LoginPage')
const LoginPage = lazy(cargarAcceso)
void cargarAcceso()
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const FrontDeskPage = lazy(() => import('@/features/frontdesk/FrontDeskPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const HousekeepingPage = lazy(() => import('@/features/housekeeping/HousekeepingPage'))
const FinancesPage = lazy(() => import('@/features/finances/FinancesPage'))
const ConfigPage = lazy(() => import('@/features/config/ConfigPage'))
const PlatformPage = lazy(() => import('@/features/platform/PlatformPage'))
const UsersPage = lazy(() => import('@/features/users/UsersPage'))
const AuditPage = lazy(() => import('@/features/audit/AuditPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const ReservationsPage = lazy(() => import('@/features/reservations/ReservationsPage'))
const CorporatePage = lazy(() => import('@/features/corporate/CorporatePage'))

/** `/` es la puerta pública para quien llega sin sesión y el atajo al tablero
 *  para quien ya entró. Vive fuera de `ProtectedRoute` -- que manda al acceso
 *  cuando no hay sesión -- justo para que un visitante pueda ver la página del
 *  producto en vez de una pantalla de contraseña. */
function Inicio() {
  const access = useAuthStore((state) => state.access)
  const user = useAuthStore((state) => state.user)

  if (access) return <Navigate to={defaultRouteFor(user)} replace />
  return (
    <LazyPublico>
      <LandingPage />
    </LazyPublico>
  )
}

/** La espera dentro de la aplicación: dos bloques con la forma de lo que viene.
 *
 *  Funciona porque se pinta **dentro** del layout, con su menú y su barra ya
 *  puestos alrededor. */
function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/** La espera de una pantalla pública: el lienzo, no un esqueleto.
 *
 *  Landing y registro ocupan la ventana entera y no tienen layout alrededor.
 *  El esqueleto de arriba, ahí, son dos barras grises flotando sobre blanco en
 *  la esquina: no se parece a nada de lo que viene después y se lee como una
 *  página rota. Pintar el mismo fondo con la misma retícula hace que la llegada
 *  del contenido sea eso -- una llegada -- y no un cambio de pantalla. */
function LienzoPublico() {
  return (
    <div className="relative min-h-dvh bg-background">
      <div className="grid-surface grid-fade pointer-events-none absolute inset-0" aria-hidden />
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

function LazyPublico({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LienzoPublico />}>{children}</Suspense>
}

const routes: RouteObject[] = [
  { path: '/', element: <Inicio />, errorElement: <RouteErrorPage /> },
  {
    path: '/login',
    errorElement: <RouteErrorPage />,
    element: (
      <LazyPublico>
        <LoginPage />
      </LazyPublico>
    ),
  },
  {
    path: '/registro',
    errorElement: <RouteErrorPage />,
    element: (
      <LazyPublico>
        <RegisterPage />
      </LazyPublico>
    ),
  },
  { path: '/sin-acceso', element: <ForbiddenPage /> },
  {
    // Ruta de layout sin `path`: sus hijos siguen resolviéndose desde la raíz
    // (`dashboard` -> `/dashboard`) y la raíz a secas queda libre para `Inicio`.
    errorElement: <RouteErrorPage />,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute section="dashboard">
            <Lazy>
              <DashboardPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'platform',
        element: (
          <ProtectedRoute section="platform">
            <Lazy>
              <PlatformPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'corporate',
        element: (
          <ProtectedRoute section="corporate">
            <Lazy>
              <CorporatePage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'frontdesk',
        element: (
          <ProtectedRoute section="frontdesk">
            <Lazy>
              <FrontDeskPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reservations',
        element: (
          <ProtectedRoute section="reservations">
            <Lazy>
              <ReservationsPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute section="inventory">
            <Lazy>
              <InventoryPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'housekeeping',
        element: (
          <ProtectedRoute section="housekeeping">
            <Lazy>
              <HousekeepingPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'finances',
        element: (
          <ProtectedRoute section="finances">
            <Lazy>
              <FinancesPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute section="reports">
            <Lazy>
              <ReportsPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute section="audit">
            <Lazy>
              <AuditPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'config',
        element: (
          <ProtectedRoute section="config">
            <Lazy>
              <ConfigPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute section="users">
            <Lazy>
              <UsersPage />
            </Lazy>
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)

// Lo que navega desde fuera de React -- el interceptor de axios cuando la
// sesión murió -- pasa por aquí en vez de recargar la página.
registrarNavegador((ruta) => void router.navigate(ruta, { replace: true }))
