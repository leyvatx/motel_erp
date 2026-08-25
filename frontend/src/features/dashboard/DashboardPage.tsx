import type { ReactNode } from 'react'
import {
  PiArrowRight,
  PiBed,
  PiCheckCircle,
  PiClock,
  PiPackage,
  PiPaintBrush,
  PiSparkle,
  PiUsers,
  PiWallet,
  PiWarning,
  PiWrench,
} from 'react-icons/pi'
import { Link } from 'react-router-dom'

import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentShift, usePendingExpenses } from '@/features/finances/hooks'
import {
  useExpiringStays,
  useRoomSummary,
  useUpcomingReservations,
} from '@/features/frontdesk/hooks'
import { useCleaningBoard, useOpenMaintenance } from '@/features/housekeeping/hooks'
import { useLowStock } from '@/features/inventory/hooks'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { Role, RoomStatus } from '@/types/api'

const roomColors: Partial<Record<RoomStatus, string>> = {
  AVAILABLE: 'bg-status-available',
  OCCUPIED: 'bg-status-occupied',
  CLEANING: 'bg-status-cleaning',
  RESERVED: 'bg-primary',
  MAINTENANCE: 'bg-status-maintenance',
  BLOCKED: 'bg-muted-foreground',
}

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const today = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function MetricCard({
  title,
  value,
  detail,
  icon,
  loading,
  tone = 'default',
}: {
  title: string
  value: string | number
  detail: string
  icon: ReactNode
  loading?: boolean
  tone?: 'default' | 'warning' | 'success'
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <div
          className={cn(
            'rounded-lg bg-muted p-2.5 text-muted-foreground',
            tone === 'warning' && 'bg-amber-500/10 text-amber-600',
            tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

interface AttentionItem {
  title: string
  detail: string
  to: string
  urgent?: boolean
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function roleActions(role: Role) {
  if (role === 'HOUSEKEEPING') {
    return [
      {
        label: 'Ver mis limpiezas',
        detail: 'Continuar tareas asignadas',
        to: '/housekeeping',
        icon: PiPaintBrush,
      },
      {
        label: 'Revisar inventario',
        detail: 'Existencias e insumos',
        to: '/inventory',
        icon: PiPackage,
      },
    ]
  }

  const actions = [
    {
      label: 'Ir a recepción',
      detail: 'Rentar y liberar habitaciones',
      to: '/frontdesk',
      icon: PiBed,
    },
    { label: 'Abrir caja', detail: 'Ventas, gastos y corte', to: '/finances', icon: PiWallet },
    {
      label: 'Ama de llaves',
      detail: 'Limpieza y mantenimiento',
      to: '/housekeeping',
      icon: PiPaintBrush,
    },
    {
      label: 'Inventario',
      detail: 'Productos y existencias',
      to: '/inventory',
      icon: PiPackage,
    },
  ]
  if (role === 'SUPERADMIN') {
    actions.push({
      label: 'Usuarios',
      detail: 'Equipo, roles y accesos',
      to: '/users',
      icon: PiUsers,
    })
  }
  return actions
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? 'RECEPTION'
  const isHousekeeping = role === 'HOUSEKEEPING'
  const isManagement = role === 'SUPERADMIN' || role === 'MANAGER'

  const rooms = useRoomSummary(!isHousekeeping)
  const expiring = useExpiringStays(!isHousekeeping)
  const upcomingReservations = useUpcomingReservations(!isHousekeeping)
  const cleaning = useCleaningBoard(isHousekeeping)
  const maintenance = useOpenMaintenance()
  const shift = useCurrentShift(!isHousekeeping)
  const expenses = usePendingExpenses(isManagement)
  const lowStock = useLowStock(isManagement || isHousekeeping)

  const counts = Object.fromEntries(
    (rooms.data ?? []).map((item) => [item.status, item.count]),
  ) as Partial<Record<RoomStatus, number>>
  const totalRooms = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
  const occupied = counts.OCCUPIED ?? 0
  const occupancy = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0
  const activeCleaning =
    cleaning.data?.results.filter((task) =>
      ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(task.status),
    ) ?? []
  const openMaintenance = maintenance.data?.results ?? []
  const urgentMaintenance = openMaintenance.filter((report) => report.priority === 'URGENT')
  const expiredStays = expiring.data?.results.filter((stay) => stay.remaining_seconds <= 0) ?? []

  const attention: AttentionItem[] = []
  expiredStays.slice(0, 2).forEach((stay) =>
    attention.push({
      title: `Habitación ${stay.room_number} vencida`,
      detail: `Renta ${stay.code} requiere atención`,
      to: '/frontdesk',
      urgent: true,
    }),
  )
  ;(upcomingReservations.data?.results ?? []).slice(0, 2).forEach((reservation) =>
    attention.push({
      title: `Próxima llegada · ${reservation.guest_name || reservation.code}`,
      detail: reservation.room_number
        ? `Habitación ${reservation.room_number}`
        : reservation.room_type_name,
      to: '/reservations',
    }),
  )
  urgentMaintenance.slice(0, 2).forEach((report) =>
    attention.push({
      title: report.room_number
        ? `Mantenimiento urgente · Hab. ${report.room_number}`
        : 'Mantenimiento urgente',
      detail: report.title,
      to: '/housekeeping',
      urgent: true,
    }),
  )
  if (isManagement && (expenses.data?.count ?? 0) > 0)
    attention.push({
      title: `${expenses.data?.count} gastos por aprobar`,
      detail: 'Pendientes de autorización de gerencia',
      to: '/finances',
    })
  ;(lowStock.data?.results ?? []).slice(0, 2).forEach((stock) =>
    attention.push({
      title: `Stock bajo · ${stock.product_name}`,
      detail: `${stock.available_quantity} disponibles en ${stock.warehouse_name}`,
      to: '/inventory',
    }),
  )
  if (isHousekeeping)
    activeCleaning.slice(0, 3).forEach((task) =>
      attention.push({
        title: `Habitación ${task.room_number} · ${task.status_display}`,
        detail: task.assigned_to_name
          ? `Asignada a ${task.assigned_to_name}`
          : 'Lista para asignar',
        to: '/housekeeping',
      }),
    )

  const displayName = user?.full_name?.split(' ')[0] || user?.username || ''
  const isLoading = rooms.isLoading || cleaning.isLoading

  return (
    <PageShell
      title={`${greeting()}, ${displayName}`}
      description={`${user?.motel_name ?? 'Tu motel'} · ${today.format(new Date())}`}
      className="overflow-auto pb-2"
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isHousekeeping ? (
            <>
              <MetricCard
                title="Mis tareas activas"
                value={activeCleaning.length}
                detail="Pendientes y en proceso"
                icon={<PiPaintBrush className="size-5" />}
                loading={cleaning.isLoading}
              />
              <MetricCard
                title="En proceso"
                value={activeCleaning.filter((task) => task.status === 'IN_PROGRESS').length}
                detail="Limpiezas iniciadas"
                icon={<PiClock className="size-5" />}
                loading={cleaning.isLoading}
              />
              <MetricCard
                title="Mantenimiento"
                value={openMaintenance.length}
                detail={`${urgentMaintenance.length} urgentes`}
                icon={<PiWrench className="size-5" />}
                loading={maintenance.isLoading}
                tone={urgentMaintenance.length ? 'warning' : 'default'}
              />
              <MetricCard
                title="Stock bajo"
                value={lowStock.data?.count ?? 0}
                detail="Insumos por reponer"
                icon={<PiPackage className="size-5" />}
                loading={lowStock.isLoading}
                tone={(lowStock.data?.count ?? 0) ? 'warning' : 'success'}
              />
            </>
          ) : (
            <>
              <MetricCard
                title="Ocupación"
                value={`${occupancy}%`}
                detail={`${occupied} de ${totalRooms} habitaciones`}
                icon={<PiBed className="size-5" />}
                loading={rooms.isLoading}
              />
              <MetricCard
                title="Disponibles"
                value={counts.AVAILABLE ?? 0}
                detail="Listas para rentar"
                icon={<PiCheckCircle className="size-5" />}
                loading={rooms.isLoading}
                tone="success"
              />
              <MetricCard
                title="Por vencer"
                value={expiring.data?.count ?? 0}
                detail={`${expiredStays.length} ya vencidas`}
                icon={<PiClock className="size-5" />}
                loading={expiring.isLoading}
                tone={expiredStays.length ? 'warning' : 'default'}
              />
              <MetricCard
                title="Limpieza"
                value={activeCleaning.length}
                detail="Habitaciones en proceso"
                icon={<PiSparkle className="size-5" />}
                loading={cleaning.isLoading}
              />
            </>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Estado de la operación</CardTitle>
              <CardDescription>
                {isHousekeeping
                  ? 'Trabajo activo del turno'
                  : 'Distribución actual de habitaciones'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {isHousekeeping ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    [
                      'Pendientes',
                      activeCleaning.filter((task) => task.status === 'PENDING').length,
                    ],
                    [
                      'Asignadas',
                      activeCleaning.filter((task) => task.status === 'ASSIGNED').length,
                    ],
                    [
                      'En proceso',
                      activeCleaning.filter((task) => task.status === 'IN_PROGRESS').length,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              ) : rooms.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : totalRooms === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay habitaciones configuradas.
                </p>
              ) : (
                (rooms.data ?? []).map((item) => (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span>{item.status_display}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', roomColors[item.status])}
                        style={{
                          width: `${Math.max((item.count / totalRooms) * 100, item.count ? 3 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to={isHousekeeping ? '/housekeeping' : '/frontdesk'}>
                  Ver operación completa <PiArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Necesita atención</CardTitle>
                  <CardDescription>Prioridades para resolver ahora</CardDescription>
                </div>
                {attention.length ? (
                  <Badge
                    variant={attention.some((item) => item.urgent) ? 'destructive' : 'secondary'}
                  >
                    {attention.length}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : attention.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <PiCheckCircle className="size-8 text-emerald-600" />
                  <p className="font-medium">Todo al día</p>
                  <p className="text-sm text-muted-foreground">No hay pendientes críticos.</p>
                </div>
              ) : (
                attention.slice(0, 5).map((item, index) => (
                  <Link
                    key={`${item.title}-${index}`}
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <PiWarning
                      className={cn(
                        'size-4 shrink-0 text-amber-600',
                        item.urgent && 'text-destructive',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <PiArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {!isHousekeeping ? (
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Turno actual</p>
                <p className="font-semibold">
                  {shift.isLoading ? 'Cargando…' : (shift.data?.code ?? 'Sin turno abierto')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas del turno</p>
                <p className="font-semibold">
                  {shift.data ? money.format(Number(shift.data.total_sales)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Efectivo esperado</p>
                <p className="font-semibold">
                  {shift.data ? money.format(Number(shift.data.expected_cash)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Folios cerrados</p>
                <p className="font-semibold">{shift.data?.folios_closed ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div>
          <h2 className="mb-3 text-base font-semibold">Accesos rápidos</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roleActions(role).map((action) => {
              const Icon = action.icon
              return (
                <Card key={action.to} asChild className="transition-colors hover:bg-muted/40">
                  <Link to={action.to} className="flex-row items-center gap-3 p-4">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{action.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{action.detail}</p>
                    </div>
                    <PiArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
