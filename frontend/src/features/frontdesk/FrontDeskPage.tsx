import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BedDouble,
  CreditCard,
  Eye,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth'
import { RentRoomDialog } from '@/features/frontdesk/components/RentRoomDialog'
import { RoomActionsDialog } from '@/features/frontdesk/components/RoomActionsDialog'
import { RoomCard } from '@/features/frontdesk/components/RoomCard'
import { StatusSummary } from '@/features/frontdesk/components/StatusSummary'
import { StayDetailDialog } from '@/features/frontdesk/components/StayDetailDialog'
import {
  useExpiringStays,
  useFinishCleaning,
  useRoomGrid,
  useRoomSummary,
} from '@/features/frontdesk/hooks'
import { useExpirationAlerts } from '@/features/frontdesk/useExpirationAlerts'
import type { RoomGridItem } from '@/features/frontdesk/types'
import { formatCountdown } from '@/lib/format'
import { secondsUntil } from '@/lib/serverTime'

export default function FrontDeskPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [rentRoom, setRentRoom] = useState<RoomGridItem | null>(null)
  const [actionsRoom, setActionsRoom] = useState<RoomGridItem | null>(null)
  const [stayId, setStayId] = useState<number | null>(null)

  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const grid = useRoomGrid(statusFilter ? { status: statusFilter } : undefined)
  const summary = useRoomSummary()
  const expiring = useExpiringStays()
  const finishCleaning = useFinishCleaning()
  const openContextMenu = useRowContextMenu()
  const canConfigure = useAuthStore(
    (state) => state.user?.role === 'MANAGER' || state.user?.role === 'SUPERADMIN',
  )

  useExpirationAlerts()

  const allRooms = useMemo(() => grid.data?.results ?? [], [grid.data])

  /** Pisos y tipos existentes, calculados de lo que realmente hay cargado. */
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

  const rooms = useMemo(
    () =>
      allRooms.filter((room) => {
        if (floorFilter !== 'all' && room.floor !== Number(floorFilter)) return false
        if (typeFilter !== 'all' && room.room_type !== Number(typeFilter)) return false
        return true
      }),
    [allRooms, floorFilter, typeFilter],
  )

  /** Mismas acciones para el clic derecho sobre la tarjeta del cuarto. */
  const roomActions = (room: RoomGridItem): RowAction[] => {
    const stay = room.current_stay
    if (stay) {
      return [
        { key: 'detail', label: 'Ver renta', icon: <Eye />, onSelect: () => setStayId(stay.id) },
        {
          key: 'extend',
          label: 'Extender tiempo',
          icon: <Plus />,
          onSelect: () => setStayId(stay.id),
        },
        {
          key: 'checkout',
          label: 'Cobrar y cerrar',
          icon: <CreditCard />,
          separated: true,
          onSelect: () => setStayId(stay.id),
        },
      ]
    }

    return [
      {
        key: 'rent',
        label: 'Rentar',
        icon: <BedDouble />,
        disabled: room.status !== 'AVAILABLE' && room.status !== 'RESERVED',
        onSelect: () => setRentRoom(room),
      },
      {
        key: 'clean',
        label: 'Marcar limpieza terminada',
        icon: <Sparkles />,
        disabled: room.status !== 'CLEANING',
        onSelect: () => finishCleaning.mutate(room.id),
      },
      {
        key: 'maintenance',
        label: 'Enviar a mantenimiento',
        icon: <Wrench />,
        separated: true,
        disabled: room.status === 'MAINTENANCE',
        onSelect: () => setActionsRoom(room),
      },
    ]
  }

  /** Un cuarto ocupado abre su renta; el resto, el menu de acciones. */
  const handleSelect = (room: RoomGridItem): void => {
    if (room.status === 'OCCUPIED' && room.current_stay) {
      setStayId(room.current_stay.id)
      return
    }
    setActionsRoom(room)
  }

  const alerts = (expiring.data?.results ?? []).filter(
    (stay) => secondsUntil(stay.expires_at) <= 15 * 60,
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto scrollbar-thin pr-1">
      <PageHeader
        title="Recepción"
        description="Estado de las habitaciones en tiempo real."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void grid.refetch()
                void summary.refetch()
              }}
              loading={grid.isFetching}
            >
              <RefreshCw />
              Actualizar
            </Button>
            {canConfigure ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/config">
                  <Settings />
                  Habitaciones y tarifas
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <StatusSummary
        data={summary.data}
        isLoading={summary.isLoading}
        activeStatus={statusFilter}
        onFilter={setStatusFilter}
      />

      {alerts.length > 0 ? (
        <Card className="border-status-cleaning/40">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-status-cleaning" aria-hidden />
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

      {/* Filtros: en un motel de dos edificios, ver solo el piso que atiendes
          ahorra recorrer el grid completo. */}
      {floors.length > 1 || types.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pisos</SelectItem>
              {floors.map((floor) => (
                <SelectItem key={floor} value={String(floor)}>
                  Piso {floor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {types.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {rooms.length} de {allRooms.length} habitaciones · clic derecho para acciones
          </span>
        </div>
      ) : null}

      {grid.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[8rem] rounded-xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-sm font-medium">Sin habitaciones que mostrar</p>
            <p className="text-sm text-muted-foreground">
              Ningún cuarto coincide con el filtro seleccionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {rooms.map((room) => (
            <div
              key={room.id}
              onContextMenu={openContextMenu(`Habitación ${room.number}`, roomActions(room))}
            >
              <RoomCard room={room} onSelect={handleSelect} />
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
