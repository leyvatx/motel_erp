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
        'group relative flex min-h-[8rem] w-full flex-col overflow-hidden rounded-xl border bg-card p-4 text-left shadow-xs',
        'transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg',
        'active:translate-y-0 active:scale-[0.99] active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
        isOccupied && countdown.level === 'expired' && 'border-status-occupied/40',
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
          <p className="text-2xl font-semibold leading-none tracking-tight tabular">
            {room.number}
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{room.room_type_name}</p>
        </div>

        {!isOccupied ? (
          <span className={cn('text-2xs font-medium', STATUS_TEXT[room.status])}>
            {room.status_display}
          </span>
        ) : null}
      </div>

      {isOccupied && stay ? (
        <div className="mt-auto space-y-2 pt-3">
          <div className={cn('flex items-baseline gap-1.5', timerTone)}>
            <Clock className="h-3.5 w-3.5 shrink-0 self-center" aria-hidden />
            <span className="font-mono text-lg font-semibold leading-none tabular">
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
            <p className="border-t pt-2 text-xs font-medium tabular">
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
