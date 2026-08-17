import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { ForbiddenPage, NotFoundPage } from '@/pages/ErrorPages'
import PlaceholderPage from '@/pages/PlaceholderPage'

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const FrontDeskPage = lazy(() => import('@/features/frontdesk/FrontDeskPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const HousekeepingPage = lazy(() => import('@/features/housekeeping/HousekeepingPage'))
const FinancesPage = lazy(() => import('@/features/finances/FinancesPage'))
const ConfigPage = lazy(() => import('@/features/config/ConfigPage'))

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

/**
 * Cada seccion declara a que parte del menu pertenece; `ProtectedRoute` la
 * compara contra el rol para no mostrar pantallas inutiles.
 */
const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
  },
  { path: '/sin-acceso', element: <ForbiddenPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/frontdesk" replace /> },
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
            <PlaceholderPage title="Reportes" description="Tablero gerencial." />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute section="audit">
            <PlaceholderPage title="Auditoría" description="Bitácora de operaciones." />
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
            <PlaceholderPage title="Usuarios" description="Altas, bajas y roles." />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
