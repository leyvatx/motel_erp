import { useState } from 'react'
import { PiCalendarPlus, PiMagnifyingGlass, PiSignIn, PiUserMinus, PiXCircle } from 'react-icons/pi'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { StatStrip } from '@/components/layout/StatStrip'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { RowActions, type RowAction } from '@/components/ui/row-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useCancelReservation,
  useMarkReservationNoShow,
  useReservations,
} from '@/features/frontdesk/hooks'
import type { Reservation } from '@/features/frontdesk/types'
import {
  ReservationCheckInDialog,
  ReservationFormDialog,
} from '@/features/reservations/ReservationDialogs'
import { formatDateTime, formatMoney } from '@/lib/format'

type Variant = NonNullable<BadgeProps['variant']>
const tones: Record<string, Variant> = {
  CONFIRMED: 'available',
  PENDING: 'secondary',
  CHECKED_IN: 'occupied',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
  EXPIRED: 'outline',
}

function localDate(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 10)
}

export default function ReservationsPage() {
  const initialEnd = new Date()
  initialEnd.setDate(initialEnd.getDate() + 30)
  const [createOpen, setCreateOpen] = useState(false)
  const [checkingIn, setCheckingIn] = useState<Reservation | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [from, setFrom] = useState(localDate(new Date()))
  const [to, setTo] = useState(localDate(initialEnd))
  const reservations = useReservations({
    page,
    page_size: pageSize,
    search: search || undefined,
    status: status === 'all' || status === 'active' ? undefined : status,
    active: status === 'active' ? true : undefined,
    from: from ? new Date(`${from}T00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    ordering: 'scheduled_start',
  })
  const cancel = useCancelReservation()
  const noShow = useMarkReservationNoShow()
  const allRows = reservations.data?.results ?? []
  const rows = allRows
  const today = new Date().toDateString()
  const todayCount = allRows.filter(
    (item) =>
      new Date(item.scheduled_start).toDateString() === today &&
      ['PENDING', 'CONFIRMED'].includes(item.status),
  ).length

  const actionsFor = (item: Reservation): RowAction[] => {
    const active = ['PENDING', 'CONFIRMED'].includes(item.status)
    return [
      {
        key: 'check-in',
        label: 'Registrar llegada',
        icon: <PiSignIn />,
        disabled: !active,
        onSelect: () => setCheckingIn(item),
      },
      {
        key: 'no-show',
        label: 'No se presentó',
        icon: <PiUserMinus />,
        disabled: !active,
        onSelect: () => {
          if (window.confirm(`¿Marcar ${item.code} como no-show?`)) noShow.mutate(item.id)
        },
      },
      {
        key: 'cancel',
        label: 'Cancelar reservación',
        icon: <PiXCircle />,
        danger: true,
        separated: true,
        disabled: !active,
        onSelect: () => {
          const reason = window.prompt('Motivo de cancelación')
          if (reason?.trim()) cancel.mutate({ id: item.id, reason: reason.trim() })
        },
      },
    ]
  }

  return (
    <PageShell
      title="Reservaciones"
      description="Llegadas programadas y asignación de habitaciones."
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <PiCalendarPlus />
          Nueva reservación
        </Button>
      }
      toolbar={
        <div className="space-y-3">
          <StatStrip
            isLoading={reservations.isLoading}
            stats={[
              { label: 'Vigentes', value: reservations.data?.count ?? 0 },
              { label: 'Llegan hoy', value: todayCount, tone: todayCount ? 'warning' : 'neutral' },
              {
                label: 'Confirmadas',
                value: allRows.filter((item) => item.status === 'CONFIRMED').length,
              },
              {
                label: 'En casa',
                value: allRows.filter((item) => item.status === 'CHECKED_IN').length,
              },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-64 flex-1 sm:max-w-sm">
              <PiMagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="pl-9"
                placeholder="Buscar folio, huésped o placas"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Vigentes</SelectItem>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                <SelectItem value="CHECKED_IN">En casa</SelectItem>
                <SelectItem value="CANCELLED">Canceladas</SelectItem>
                <SelectItem value="NO_SHOW">No-show</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="Hasta"
            />
          </div>
        </div>
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Llegada</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead>Habitación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Anticipo</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.isLoading ? (
                Array.from({ length: 7 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length ? (
                rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{formatDateTime(item.scheduled_start)}</p>
                      <p className="text-xs text-muted-foreground">{item.code}</p>
                    </TableCell>
                    <TableCell>
                      <p>{item.guest_name || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.guest_phone || item.vehicle_plate || 'Sin contacto'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.room_number ? `Hab. ${item.room_number}` : item.room_type_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tones[item.status] ?? 'outline'}>{item.status_display}</Badge>
                    </TableCell>
                    <TableCell>{formatMoney(item.deposit_amount)}</TableCell>
                    <TableCell>
                      <RowActions items={actionsFor(item)} label={item.code} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={6} message="No se encontraron reservaciones." />
              )}
            </TableBody>
          </Table>
        </TableScroll>
        {reservations.data ? (
          <Pagination
            page={reservations.data.page}
            pageSize={reservations.data.page_size}
            count={reservations.data.count}
            totalPages={reservations.data.total_pages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            isFetching={reservations.isFetching}
          />
        ) : null}
      </Card>
      <ReservationFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ReservationCheckInDialog
        reservation={checkingIn}
        open={checkingIn !== null}
        onOpenChange={(open) => {
          if (!open) setCheckingIn(null)
        }}
      />
    </PageShell>
  )
}
