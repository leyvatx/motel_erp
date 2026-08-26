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
import { useCurrentShift, usePendingExpenses, useShiftTrend } from '@/features/finances/hooks'
import { RoomDonut } from '@/features/dashboard/charts/RoomDonut'
import { ShiftTrendChart } from '@/features/dashboard/charts/ShiftTrendChart'
import { Sparkline } from '@/features/dashboard/charts/Sparkline'
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
  trend,
}: {
  title: string
  value: string | number
  detail: string
  icon: ReactNode
  loading?: boolean
  tone?: 'default' | 'warning' | 'success'
  /** Un punto por hora. Solo se pasa donde hay historia real; ver Sparkline. */
  trend?: number[]
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex h-full items-center justify-between gap-2 p-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-xl font-bold leading-tight tracking-tight tabular">{value}</p>
          )}
          <p className="truncate text-2xs text-muted-foreground">{detail}</p>
        </div>

        {trend && trend.length > 1 ? (
          <Sparkline values={trend} className="h-9 w-14 shrink-0" />
        ) : (
          <div
            className={cn(
              'shrink-0 rounded-lg bg-muted p-2 text-muted-foreground',
              tone === 'warning' && 'bg-amber-500/10 text-amber-600',
              tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
            )}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Accesos rápidos comprimidos: antes eran cuatro tarjetas del ancho de la
 *  pantalla al fondo de la página, o sea la razón principal del scroll. */
function QuickActions({ actions }: { actions: ReturnType<typeof roleActions> }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.to}
            asChild
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2"
            title={action.detail}
          >
            <Link to={action.to}>
              <Icon className="size-4 shrink-0" />
              <span className="hidden text-xs xl:inline">{action.label}</span>
            </Link>
          </Button>
        )
      })}
    </div>
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
  const trend = useShiftTrend(!isHousekeeping)

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
  const trendHours = trend.data?.hours ?? []
  const rentalsPerHour = trendHours.map((hora) => hora.rentals)

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
      className="min-h-0"
    >
      {/*
        Bento de 12 columnas. Las filas son [auto auto 1fr]: la franja del turno
        y las métricas piden lo que necesitan, y el resto del alto se lo queda la
        fila de abajo, que es la que tiene que estirarse para que no sobre ni
        falte. En 1080p entra completo sin scroll de página; abajo de lg se apila
        y el scroll natural del móvil hace su trabajo.
      */}
      <div className="grid min-h-0 grid-cols-1 gap-3 lg:h-full lg:grid-cols-12 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
        {/* ── Franja del turno + accesos rápidos ─────────────────────────── */}
        <Card className="lg:col-span-12">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
            {!isHousekeeping ? (
              <>
                <ShiftFigure
                  label="Turno"
                  value={shift.isLoading ? '…' : (shift.data?.code ?? 'Sin turno')}
                />
                <ShiftFigure
                  label="Ventas"
                  value={shift.data ? money.format(Number(shift.data.total_sales)) : '—'}
                />
                <ShiftFigure
                  label="Efectivo esperado"
                  value={shift.data ? money.format(Number(shift.data.expected_cash)) : '—'}
                />
                <ShiftFigure label="Folios" value={String(shift.data?.folios_closed ?? '—')} />
              </>
            ) : (
              <ShiftFigure label="Tareas activas" value={String(activeCleaning.length)} />
            )}

            <div className="ml-auto">
              <QuickActions actions={roleActions(role)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Cuatro métricas ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-8 lg:grid-cols-4">
          {isHousekeeping ? (
            <>
              <MetricCard
                title="Mis tareas activas"
                value={activeCleaning.length}
                detail="Pendientes y en proceso"
                icon={<PiPaintBrush className="size-4" />}
                loading={cleaning.isLoading}
              />
              <MetricCard
                title="En proceso"
                value={activeCleaning.filter((task) => task.status === 'IN_PROGRESS').length}
                detail="Limpiezas iniciadas"
                icon={<PiClock className="size-4" />}
                loading={cleaning.isLoading}
              />
              <MetricCard
                title="Mantenimiento"
                value={openMaintenance.length}
                detail={`${urgentMaintenance.length} urgentes`}
                icon={<PiWrench className="size-4" />}
                loading={maintenance.isLoading}
                tone={urgentMaintenance.length ? 'warning' : 'default'}
              />
              <MetricCard
                title="Stock bajo"
                value={lowStock.data?.count ?? 0}
                detail="Insumos por reponer"
                icon={<PiPackage className="size-4" />}
                loading={lowStock.isLoading}
                tone={(lowStock.data?.count ?? 0) ? 'warning' : 'success'}
              />
            </>
          ) : (
            <>
              {/* La única con sparkline: rentas por hora es historia de verdad,
                  el conteo de renglones Stay del turno. Las otras tres son fotos
                  del momento y nada guarda cómo estaban hace una hora. */}
              <MetricCard
                title="Ocupación"
                value={`${occupancy}%`}
                detail={`${occupied} de ${totalRooms} · rentas/hora`}
                icon={<PiBed className="size-4" />}
                loading={rooms.isLoading}
                trend={rentalsPerHour}
              />
              <MetricCard
                title="Disponibles"
                value={counts.AVAILABLE ?? 0}
                detail="Listas para rentar"
                icon={<PiCheckCircle className="size-4" />}
                loading={rooms.isLoading}
                tone="success"
              />
              <MetricCard
                title="Por vencer"
                value={expiring.data?.count ?? 0}
                detail={`${expiredStays.length} ya vencidas`}
                icon={<PiClock className="size-4" />}
                loading={expiring.isLoading}
                tone={expiredStays.length ? 'warning' : 'default'}
              />
              <MetricCard
                title="Limpieza"
                value={activeCleaning.length}
                detail="Habitaciones en proceso"
                icon={<PiSparkle className="size-4" />}
                loading={cleaning.isLoading}
              />
            </>
          )}
        </div>

        {/* ── Necesita atención: ocupa las dos filas de la derecha ────────── */}
        <Card className="flex min-h-0 flex-col lg:col-span-4 lg:row-span-2">
          <CardHeader className="shrink-0 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Necesita atención</CardTitle>
                <CardDescription className="text-xs">Prioridades para ahora</CardDescription>
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

          {/*
            El scroll vive aquí y en ningún otro lado. En móvil lo acota max-h,
            donde la página sí se desplaza; en escritorio el min-h-0 sobre el
            flex es lo que impide que la tarjeta crezca más allá de su celda.
            Sin ese min-h-0 un flex-item se niega a encoger por debajo de su
            contenido, y veinte alertas de stock empujan el scroll a la página
            entera, que es justo lo que veníamos a arreglar.
          */}
          <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-thin pt-0 max-lg:max-h-72">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : attention.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                <PiCheckCircle className="size-7 text-emerald-600" />
                <p className="text-sm font-medium">Todo al día</p>
                <p className="text-xs text-muted-foreground">No hay pendientes críticos.</p>
              </div>
            ) : (
              attention.map((item, index) => (
                <Link
                  key={`${item.title}-${index}`}
                  to={item.to}
                  className="flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
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

        {/* ── Distribución: anillo con la leyenda a la derecha ────────────── */}
        <Card className="flex min-h-0 flex-col lg:col-span-4">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base">
              {isHousekeeping ? 'Trabajo del turno' : 'Distribución'}
            </CardTitle>
            <CardDescription className="text-xs">
              {isHousekeeping ? 'Tareas por estado' : 'Habitaciones ahora'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 items-center pt-0">
            {isHousekeeping ? (
              <div className="grid w-full grid-cols-3 gap-2">
                {(
                  [
                    ['Pendientes', 'PENDING'],
                    ['Asignadas', 'ASSIGNED'],
                    ['En proceso', 'IN_PROGRESS'],
                  ] as const
                ).map(([label, estado]) => (
                  <div key={estado} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xl font-semibold tabular">
                      {activeCleaning.filter((task) => task.status === estado).length}
                    </p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <RoomDonut data={rooms.data ?? []} total={totalRooms} loading={rooms.isLoading} />
            )}
          </CardContent>
        </Card>

        {/* ── Tendencia del turno ─────────────────────────────────────────── */}
        <Card className="flex min-h-0 flex-col lg:col-span-4">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base">Tendencia del turno</CardTitle>
            <CardDescription className="text-xs">
              {trend.data?.shift ? `Ventas por hora · ${trend.data.shift}` : 'Ventas por hora'}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 pt-0 max-lg:h-48">
            <ShiftTrendChart hours={trendHours} loading={trend.isLoading} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

function ShiftFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular">{value}</p>
    </div>
  )
}
