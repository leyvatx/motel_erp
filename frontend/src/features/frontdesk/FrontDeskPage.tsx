import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PiArrowsClockwise,
  PiBed,
  PiCalendar,
  PiCreditCard,
  PiEye,
  PiGear,
  PiMagnifyingGlass,
  PiPlus,
  PiSignIn,
  PiSparkle,
  PiWarning,
  PiWrench,
} from 'react-icons/pi'

import { ModuleHelp } from '@/components/layout/ModuleHelp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, OfflineState, estadoDeConsulta } from '@/components/ui/states'
import { canManageCatalog, useAuthStore } from '@/store/auth'
import { RentRoomDialog } from '@/features/frontdesk/components/RentRoomDialog'
import { RoomActionsDialog } from '@/features/frontdesk/components/RoomActionsDialog'
import { RelojOperativo } from '@/features/frontdesk/components/RelojOperativo'
import { RoomCard } from '@/features/frontdesk/components/RoomCard'
import { StatusSummary } from '@/features/frontdesk/components/StatusSummary'
import { StayDetailDialog } from '@/features/frontdesk/components/StayDetailDialog'
import {
  useExpiringStays,
  useFinishCleaning,
  useRequestCleaning,
  useRoomGrid,
  useRoomSummary,
  useUpcomingReservations,
} from '@/features/frontdesk/hooks'
import { useExpirationAlerts } from '@/features/frontdesk/useExpirationAlerts'
import type { RoomGridItem } from '@/features/frontdesk/types'
import { formatCountdown } from '@/lib/format'
import { secondsUntil } from '@/lib/serverTime'

export default function FrontDeskPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [rentRoom, setRentRoom] = useState<RoomGridItem | null>(null)
  const [actionsRoom, setActionsRoom] = useState<RoomGridItem | null>(null)
  const [stayId, setStayId] = useState<number | null>(null)

  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [busqueda, setBusqueda] = useState('')

  const grid = useRoomGrid(statusFilter ? { status: statusFilter } : undefined)
  const summary = useRoomSummary()
  const expiring = useExpiringStays()
  const upcomingReservations = useUpcomingReservations()
  const finishCleaning = useFinishCleaning()
  const requestCleaning = useRequestCleaning()
  const openContextMenu = useRowContextMenu()
  const canConfigure = useAuthStore((state) => canManageCatalog(state.user))

  useExpirationAlerts()

  const allRooms = useMemo(() => grid.data?.results ?? [], [grid.data])

  const floors = useMemo(
    () => [...new Set(allRooms.map((room) => room.floor))].sort((a, b) => a - b),
    [allRooms],
  )
  const types = useMemo(
    () =>
      [...new Map(allRooms.map((room) => [room.room_type, room.room_type_name])).entries()].sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [allRooms],
  )

  const rooms = useMemo(() => {
    // Se busca por lo que recepción tiene a la mano cuando alguien llega al
    // mostrador: el número del cuarto, las placas del coche o el nombre con el
    // que entró.
    const texto = busqueda.trim().toLowerCase()

    return allRooms.filter((room) => {
      if (floorFilter !== 'all' && room.floor !== Number(floorFilter)) return false
      if (typeFilter !== 'all' && room.room_type !== Number(typeFilter)) return false
      if (!texto) return true

      const stay = room.current_stay
      return [room.number, room.room_type_name, stay?.vehicle_plate, stay?.guest_name]
        .filter(Boolean)
        .some((campo) => (campo as string).toLowerCase().includes(texto))
    })
  }, [allRooms, floorFilter, typeFilter, busqueda])

  const arrivingByRoom = useMemo(
    () =>
      new Map(
        (upcomingReservations.data?.results ?? [])
          .filter((item) => item.room !== null)
          .map((item) => [item.room as number, item]),
      ),
    [upcomingReservations.data],
  )

  const roomActions = (room: RoomGridItem): RowAction[] => {
    const stay = room.current_stay
    if (stay) {
      return [
        { key: 'detail', label: 'Ver renta', icon: <PiEye />, onSelect: () => setStayId(stay.id) },
        {
          key: 'extend',
          label: t('recepcion.extenderTiempo'),
          icon: <PiPlus />,
          onSelect: () => setStayId(stay.id),
        },
        {
          key: 'checkout',
          label: t('recepcion.cobrarYCerrar'),
          icon: <PiCreditCard />,
          separated: true,
          onSelect: () => setStayId(stay.id),
        },
      ]
    }

    const rentable = room.status === 'AVAILABLE' || room.status === 'RESERVED'
    const arriving = arrivingByRoom.get(room.id)

    return [
      ...(arriving && rentable
        ? [
            {
              key: 'check-in',
              label: `Registrar llegada de ${arriving.guest_name || arriving.code}`,
              icon: <PiSignIn />,
              onSelect: () => setActionsRoom(room),
            },
          ]
        : []),
      {
        key: 'rent',
        label: arriving && rentable ? t('recepcion.rentarAOtraPersona') : t('recepcion.rentar'),
        icon: <PiBed />,
        disabled: !rentable,
        onSelect: () => setRentRoom(room),
      },
      {
        key: 'clean',
        label: t('recepcion.marcarLimpiezaTerminada'),
        icon: <PiSparkle />,
        disabled: room.status !== 'CLEANING',
        onSelect: () => finishCleaning.mutate(room.id),
      },
      {
        key: 'maintenance',
        label: t('recepcion.enviarAMantenimiento'),
        icon: <PiWrench />,
        separated: true,
        disabled: room.status === 'MAINTENANCE',
        onSelect: () => setActionsRoom(room),
      },
    ]
  }

  const handleSelect = (room: RoomGridItem): void => {
    if (room.status === 'OCCUPIED' && room.current_stay) {
      setStayId(room.current_stay.id)
      return
    }
    setActionsRoom(room)
  }

  // El buscador global manda aquí con ?habitacion=101. Se espera a que la
  // cuadrícula cargue -- antes no hay dónde buscar el número -- y se limpia el
  // parámetro pase lo que pase, para que recargar no vuelva a abrir el diálogo.
  const pedida = searchParams.get('habitacion')
  useEffect(() => {
    if (!pedida || grid.isPending) return
    const room = allRooms.find((item) => item.number === pedida)
    if (room) handleSelect(room)
    setSearchParams({}, { replace: true })
  }, [pedida, grid.isPending, allRooms, setSearchParams])

  const estadoGrid = estadoDeConsulta(grid)

  const alerts = (expiring.data?.results ?? []).filter(
    (stay) => secondsUntil(stay.expires_at) <= 15 * 60,
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-auto scrollbar-thin pr-1">
      {/* Toolbar en una sola franja: métricas, buscador, filtros, reloj y
          accesos. Antes eran cuatro renglones -- encabezado, tarjetas de
          métrica, avisos y filtros -- y en un monitor de mostrador eso es media
          pantalla que la cuadrícula no usa. En el teléfono se parte en dos: las
          fichas se deslizan y los controles quedan debajo. */}
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <StatusSummary
          data={summary.data}
          isLoading={summary.isLoading}
          activeStatus={statusFilter}
          onFilter={setStatusFilter}
        />

        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          {/* Renglón propio en el teléfono: con `flex-1` dentro de una fila que
              se parte, el campo se encogía hasta encimarse con los selectores. */}
          <div className="relative w-full sm:w-56">
            <PiMagnifyingGlass
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder={t('recepcion.buscarPlaceholder')}
              aria-label={t('recepcion.buscarHabitacion')}
              className="h-11 w-full pl-8 sm:h-9"
            />
          </div>

          {floors.length > 1 ? (
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger
                className="h-11 w-auto min-w-[7rem] sm:h-9"
                aria-label={t('recepcion.filtrarPorPiso')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('recepcion.todosLosPisos')}</SelectItem>
                {floors.map((floor) => (
                  <SelectItem key={floor} value={String(floor)}>
                    Piso {floor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {types.length > 1 ? (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="h-11 w-auto min-w-[8rem] sm:h-9"
                aria-label={t('recepcion.filtrarPorTipo')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('recepcion.todosLosTipos')}</SelectItem>
                {types.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <RelojOperativo />

          <ModuleHelp modulo="recepcion" />

          {/* Sin texto donde no cabe: el icono se queda y la palabra vuelve en
              pantallas anchas. El área de toque no baja de 44 px. */}
          <Button
            variant="outline"
            className="h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3"
            onClick={() => {
              void grid.refetch()
              void summary.refetch()
            }}
            loading={grid.isFetching}
            aria-label={t('recepcion.actualizar')}
          >
            <PiArrowsClockwise />
            <span className="hidden lg:inline">{t('recepcion.actualizar')}</span>
          </Button>

          <Button variant="outline" className="h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3" asChild>
            <Link to="/reservations" aria-label={t('recepcion.reservaciones')}>
              <PiCalendar />
              <span className="hidden lg:inline">{t('recepcion.reservaciones')}</span>
            </Link>
          </Button>

          {canConfigure ? (
            <Button variant="outline" className="h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3" asChild>
              <Link to="/config" aria-label={t('recepcion.habitacionesYTarifas')}>
                <PiGear />
                <span className="hidden lg:inline">{t('recepcion.tarifas')}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {alerts.length > 0 ? (
        <Card className="border-status-cleaning/40">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <PiWarning className="h-4 w-4 text-status-cleaning" aria-hidden />
              {alerts.length} {alerts.length === 1 ? 'renta requiere' : 'rentas requieren'} atención
            </span>
            <div className="flex flex-wrap gap-1.5">
              {alerts.map((stay) => (
                <button
                  key={stay.id}
                  type="button"
                  onClick={() => setStayId(stay.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{stay.room_number}</span>
                  <span className="font-mono tabular text-muted-foreground">
                    {formatCountdown(secondsUntil(stay.expires_at))}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(upcomingReservations.data?.count ?? 0) > 0 ? (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <PiCalendar className="size-4 text-primary" />
              {upcomingReservations.data?.count} próximas llegadas
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {(upcomingReservations.data?.results ?? []).slice(0, 5).map((item) => (
                <span key={item.id} className="rounded-md border bg-background px-2 py-1 text-xs">
                  {item.room_number ? `Hab. ${item.room_number}` : item.room_type_name} ·{' '}
                  {item.guest_name || item.code}
                </span>
              ))}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/reservations">{t('recepcion.verTodas')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t('recepcion.deHabitaciones', { visibles: rooms.length, total: allRooms.length })}
        {/* El clic derecho quedó como atajo de quien opera con mouse todo el
            día; el mismo menú está en el botón ⋯ de cada tarjeta, que es lo
            único que existe en una tableta. */}
        <span className="hidden lg:inline"> {t('recepcion.clicDerechoAtajo')}</span>
      </p>

      {/* Tres finales distintos, y la diferencia importa: "no hay cuartos" es
          una configuración pendiente, "no coincide nada" es un filtro puesto, y
          "no pudimos cargar" es un problema que se reintenta. Pintar los tres
          como una lista vacía hacía creer que se habían borrado las
          habitaciones justo cuando el servidor no contestaba. */}
      {estadoGrid === 'error' ? (
        <Card>
          <ErrorState
            title={t('recepcion.noPudimosCargar')}
            description={t('recepcion.noLlegoElTablero')}
            onRetry={() => void grid.refetch()}
            retrying={grid.isFetching}
          />
        </Card>
      ) : estadoGrid === 'sin-conexion' ? (
        <Card>
          <OfflineState descripcion={t('recepcion.habitacionesSiguenAhi')} />
        </Card>
      ) : estadoGrid === 'cargando' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {Array.from({ length: 18 }).map((_, index) => (
            <Skeleton key={index} className="h-[8rem] rounded-xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState
            title={
              allRooms.length === 0
                ? t('recepcion.sinHabitaciones')
                : t('recepcion.ningunCuartoCoincide')
            }
            description={
              allRooms.length === 0
                ? t('recepcion.sinHabitacionesDetalle')
                : t('recepcion.pruebaConOtroPiso')
            }
            icon={<PiBed className="h-8 w-8" aria-hidden />}
            action={
              allRooms.length === 0 ? (
                canConfigure ? (
                  <Button asChild>
                    <Link to="/config?seccion=habitaciones">
                      {t('recepcion.darDeAltaHabitaciones')}
                    </Link>
                  </Button>
                ) : null
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusqueda('')
                    setFloorFilter('all')
                    setTypeFilter('all')
                    setStatusFilter(null)
                  }}
                >
                  {t('recepcion.quitarFiltros')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {rooms.map((room) => (
            <div
              key={room.id}
              onContextMenu={openContextMenu(`Habitación ${room.number}`, roomActions(room))}
            >
              <RoomCard
                room={room}
                actions={roomActions(room)}
                onSelect={handleSelect}
                onRent={setRentRoom}
                onCheckout={(item) => item.current_stay && setStayId(item.current_stay.id)}
                onRequestCleaning={(item) => requestCleaning.mutate(item.id)}
                onFinishCleaning={(item) => finishCleaning.mutate(item.id)}
                busy={requestCleaning.isPending || finishCleaning.isPending}
              />
            </div>
          ))}
        </div>
      )}

      <RoomActionsDialog
        room={actionsRoom}
        open={actionsRoom !== null}
        onOpenChange={(open) => !open && setActionsRoom(null)}
        onRent={(room) => {
          setActionsRoom(null)
          setRentRoom(room)
        }}
      />

      <RentRoomDialog
        room={rentRoom}
        open={rentRoom !== null}
        onOpenChange={(open) => !open && setRentRoom(null)}
      />

      <StayDetailDialog
        stayId={stayId}
        open={stayId !== null}
        onOpenChange={(open) => !open && setStayId(null)}
      />
    </div>
  )
}
