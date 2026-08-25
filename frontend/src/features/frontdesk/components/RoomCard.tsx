import { Car, Clock, Users } from 'lucide-react'

import { useCountdown } from '@/hooks/useCountdown'
import { formatCountdown, formatMoney, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RoomGridItem } from '@/features/frontdesk/types'
import type { RoomStatus } from '@/types/api'

const STATUS_BAR: Record<RoomStatus, string> = {
  AVAILABLE: 'bg-status-available',
  RESERVED: 'bg-brand-accent',
  OCCUPIED: 'bg-status-occupied',
  CLEANING: 'bg-status-cleaning',
  MAINTENANCE: 'bg-status-maintenance',
  BLOCKED: 'bg-status-maintenance',
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  AVAILABLE: 'text-status-available',
  RESERVED: 'text-brand-accent',
  OCCUPIED: 'text-status-occupied',
  CLEANING: 'text-status-cleaning',
  MAINTENANCE: 'text-status-maintenance',
  BLOCKED: 'text-status-maintenance',
}

interface Props {
  room: RoomGridItem
  onSelect: (room: RoomGridItem) => void
  warningMinutes?: number
}

export function RoomCard({ room, onSelect, warningMinutes = 15 }: Props) {
  const stay = room.current_stay
  const countdown = useCountdown(stay?.expires_at, { warningMinutes })
  const isOccupied = room.status === 'OCCUPIED' && stay !== null

  const timerTone =
    countdown.level === 'expired'
      ? 'text-status-occupied'
      : countdown.level === 'warning'
        ? 'text-status-cleaning'
        : 'text-foreground'

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      aria-label={`Habitación ${room.number}, ${room.status_display}`}
      className={cn(
        'group relative flex min-h-[8.5rem] w-full flex-col overflow-hidden rounded-lg border bg-card p-4 text-left',
        'transition-colors duration-150 hover:border-foreground/25 hover:bg-accent/40',
        'active:bg-accent/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isOccupied && countdown.level === 'expired' && 'border-status-occupied/50',
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[3px]',
          STATUS_BAR[room.status],
          isOccupied && countdown.level === 'expired' && 'animate-pulse-alert',
        )}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-medium leading-none tracking-tightest">
            {room.number}
          </p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{room.room_type_name}</p>
        </div>

        {!isOccupied ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide',
              STATUS_TEXT[room.status],
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', STATUS_BAR[room.status])}
              aria-hidden
            />
            {room.status_display}
          </span>
        ) : null}
      </div>

      {isOccupied && stay ? (
        <div className="mt-auto space-y-2 pt-3">
          <div className={cn('flex items-baseline gap-1.5', timerTone)}>
            <Clock className="h-3.5 w-3.5 shrink-0 self-center" aria-hidden />
            <span className="font-mono text-lg font-medium leading-none tracking-tight">
              {formatCountdown(countdown.seconds)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
            <span className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden />
                {stay.occupants}
              </span>
              {stay.vehicle_plate ? (
                <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
                  <Car className="h-3 w-3" aria-hidden />
                  {stay.vehicle_plate}
                </span>
              ) : null}
            </span>
            <span>{formatTime(stay.check_in_at)}</span>
          </div>

          {stay.folio_total ? (
            <p className="border-t pt-2 font-mono text-xs font-medium">
              {formatMoney(stay.folio_total)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-auto pt-3">
          {room.out_of_service_reason ? (
            <p className="line-clamp-2 text-2xs text-muted-foreground">
              {room.out_of_service_reason}
            </p>
          ) : (
            <p className="text-2xs text-muted-foreground/60">
              {room.status === 'AVAILABLE' ? 'Lista para rentar' : room.zone || 'Sin renta activa'}
            </p>
          )}
        </div>
      )}
    </button>
  )
}
