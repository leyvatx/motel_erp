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
import { useTranslation } from 'react-i18next'

import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentShift, usePendingExpenses, useShiftTrend } from '@/features/finances/hooks'
import { PaymentMix, RoomDonut, ShiftTrendChart, Sparkline } from '@/features/dashboard/charts/lazy'
import {
  useExpiringStays,
  useRoomSummary,
  useUpcomingReservations,
} from '@/features/frontdesk/hooks'
import { useBrand } from '@/features/config/hooks'
import { useCleaningBoard, useOpenMaintenance } from '@/features/housekeeping/hooks'
import { SetupChecklist } from '@/features/onboarding/SetupChecklist'
import { useLowStock } from '@/features/inventory/hooks'
import i18n from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { Role, RoomStatus } from '@/types/api'

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/** La fecha del saludo, en el idioma que esté puesto. Se arma en cada render y
 *  no una vez al importar: el formateador de módulo se quedaba en español para
 *  siempre, y al cambiar a inglés el saludo quedaba a medias. */
function fechaDeHoy(): string {
  return new Intl.DateTimeFormat(i18n.language?.startsWith('en') ? 'en-US' : 'es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

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
            className="h-11 shrink-0 gap-1.5 px-2.5 lg:h-9"
            title={action.detail}
          >
            <Link to={action.to}>
              <Icon className="size-4 shrink-0" />
              <span className="hidden text-xs lg:inline">{action.label}</span>
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
  if (hour < 12) return i18n.t('tablero.buenosDias')
  if (hour < 19) return i18n.t('tablero.buenasTardes')
  return i18n.t('tablero.buenasNoches')
}

function roleActions(role: Role) {
  if (role === 'HOUSEKEEPING') {
    return [
      {
        label: i18n.t('tablero.verMisLimpiezas'),
        detail: i18n.t('tablero.continuarTareas'),
        to: '/housekeeping',
        icon: PiPaintBrush,
      },
      {
        label: i18n.t('tablero.revisarInventario'),
        detail: i18n.t('tablero.existenciasEInsumos'),
        to: '/inventory',
        icon: PiPackage,
      },
    ]
  }

  const actions = [
    {
      label: i18n.t('tablero.irARecepcion'),
      detail: i18n.t('tablero.rentarYLiberar'),
      to: '/frontdesk',
      icon: PiBed,
    },
    {
      label: i18n.t('tablero.abrirCaja'),
      detail: i18n.t('tablero.ventasGastosCorte'),
      to: '/finances',
      icon: PiWallet,
    },
    {
      label: i18n.t('tablero.amaDeLlaves'),
      detail: i18n.t('tablero.limpiezaYMantenimiento'),
      to: '/housekeeping',
      icon: PiPaintBrush,
    },
    {
      label: i18n.t('tablero.inventario'),
      detail: i18n.t('tablero.productosYExistencias'),
      to: '/inventory',
      icon: PiPackage,
    },
  ]
  if (role === 'SUPERADMIN') {
    actions.push({
      label: i18n.t('tablero.usuarios'),
      detail: i18n.t('tablero.equipoRolesAccesos'),
      to: '/users',
      icon: PiUsers,
    })
  }
  return actions
}

export default function DashboardPage() {
  const { t } = useTranslation()
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
      detail: t('tablero.pendientesAutorizacion'),
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
          : t('tablero.listaParaAsignar'),
        to: '/housekeeping',
      }),
    )

  const displayName = user?.full_name?.split(' ')[0] || user?.username || ''
  const { name: businessName } = useBrand()
  const isLoading = rooms.isLoading || cleaning.isLoading

  return (
    <PageShell
      title={`${greeting()}, ${displayName}`}
      description={`${businessName || user?.motel_name || t('tablero.tuSucursal')} · ${fechaDeHoy()}`}
      className="min-h-0 overflow-y-auto pb-1 lg:overflow-hidden lg:pb-0"
    >
      {/*
        Bento de 12 columnas. Las filas son [auto auto 1fr]: la franja del turno
        y las métricas piden lo que necesitan, y el resto del alto se lo queda la
        fila de abajo, que es la que tiene que estirarse para que no sobre ni
        falte. En 1080p entra completo sin scroll de página; abajo de lg se apila
        y el scroll natural del móvil hace su trabajo.
      */}
      <div className="mb-3 shrink-0 empty:mb-0">
        <SetupChecklist />
      </div>

      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:grid-rows-[auto_auto_minmax(0,1fr)]">
        {/* ── Franja del turno + accesos rápidos ─────────────────────────── */}
        <Card className="lg:col-span-12">
          <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-x-6">
            {!isHousekeeping ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:flex lg:gap-x-6">
                <ShiftFigure
                  label={t('tablero.turno')}
                  value={shift.isLoading ? '…' : (shift.data?.code ?? t('comun.sinTurno'))}
                />
                <ShiftFigure
                  label={t('tablero.ventas')}
                  value={shift.data ? money.format(Number(shift.data.total_sales)) : '—'}
                />
                <ShiftFigure
                  label={t('tablero.efectivoEsperado')}
                  value={shift.data ? money.format(Number(shift.data.expected_cash)) : '—'}
                />
                <ShiftFigure
                  label={t('tablero.folios')}
                  value={String(shift.data?.folios_closed ?? '—')}
                />
              </div>
            ) : (
              <ShiftFigure
                label={t('tablero.tareasActivas')}
                value={String(activeCleaning.length)}
              />
            )}

            {!isHousekeeping ? (
              <PaymentMix shift={shift.data} className="lg:w-56 lg:shrink-0" />
            ) : null}

            <div className="-mx-1 overflow-x-auto scrollbar-thin lg:ml-auto lg:mx-0 lg:overflow-visible">
              <QuickActions actions={roleActions(role)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Cuatro métricas ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-8 lg:grid-cols-4">
          {isHousekeeping ? (
            <>
              <MetricCard
                title={t('tablero.misTareasActivas')}
                value={activeCleaning.length}
                detail={t('tablero.pendientesYEnProceso')}
                icon={<PiPaintBrush className="size-4" />}
                loading={cleaning.isLoading}
              />
              <MetricCard
                title={t('tablero.enProceso')}
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
                title={t('tablero.stockBajo')}
                value={lowStock.data?.count ?? 0}
                detail={t('tablero.insumosPorReponer')}
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
                title={t('tablero.ocupacion')}
                value={`${occupancy}%`}
                detail={t('tablero.deRentasPorHora', {
                  ocupadas: occupied,
                  total: totalRooms,
                })}
                icon={<PiBed className="size-4" />}
                loading={rooms.isLoading}
                trend={rentalsPerHour}
              />
              <MetricCard
                title="Disponibles"
                value={counts.AVAILABLE ?? 0}
                detail={t('tablero.listasParaRentar')}
                icon={<PiCheckCircle className="size-4" />}
                loading={rooms.isLoading}
                tone="success"
              />
              <MetricCard
                title={t('tablero.porVencer')}
                value={expiring.data?.count ?? 0}
                detail={t('tablero.yaVencidas', { cuantas: expiredStays.length })}
                icon={<PiClock className="size-4" />}
                loading={expiring.isLoading}
                tone={expiredStays.length ? 'warning' : 'default'}
              />
              {/* Cuenta tareas abiertas, no cuartos en limpieza: recepción
                  puede pedir una limpieza de un cuarto que sigue disponible, y
                  decir "habitaciones en proceso" hacía que la suma de las
                  cuatro tarjetas pasara del total de cuartos. */}
              <MetricCard
                title="Limpieza"
                value={activeCleaning.length}
                detail="Tareas abiertas"
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
                <CardTitle className="text-base">{t('tablero.necesitaAtencion')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('tablero.prioridadesParaAhora')}
                </CardDescription>
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
          <CardContent className="max-h-72 min-h-0 space-y-2 overflow-y-auto scrollbar-thin pt-0 lg:max-h-none lg:flex-1">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : attention.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                <PiCheckCircle className="size-7 text-emerald-600" />
                <p className="text-sm font-medium">{t('tablero.todoAlDia')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('tablero.sinPendientesCriticos')}
                </p>
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
        <Card className="flex min-h-0 flex-col lg:col-span-3">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base">
              {isHousekeeping ? t('tablero.trabajoDelTurno') : t('tablero.distribucion')}
            </CardTitle>
            <CardDescription className="text-xs">
              {isHousekeeping ? t('tablero.tareasPorEstado') : t('tablero.habitacionesAhora')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-56 min-h-0 items-center pt-0 lg:h-auto lg:flex-1">
            {isHousekeeping ? (
              <div className="grid w-full grid-cols-3 gap-2">
                {(
                  [
                    ['Pendientes', 'PENDING'],
                    ['Asignadas', 'ASSIGNED'],
                    [t('tablero.enProceso'), 'IN_PROGRESS'],
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
        <Card className="flex min-h-0 flex-col lg:col-span-5">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base">{t('tablero.tendenciaDelTurno')}</CardTitle>
            <CardDescription className="text-xs">
              {trend.data?.shift
                ? t('tablero.ventasPorHora', { turno: trend.data.shift })
                : t('tablero.ventasPorHora')}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-52 min-h-0 pt-0 lg:h-auto lg:flex-1">
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
