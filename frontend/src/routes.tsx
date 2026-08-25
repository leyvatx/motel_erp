import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { ForbiddenPage, NotFoundPage } from '@/pages/ErrorPages'
import { defaultRouteFor, useAuthStore } from '@/store/auth'

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
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

function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={defaultRouteFor(user)} replace />
}

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
      { index: true, element: <HomeRedirect /> },
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
