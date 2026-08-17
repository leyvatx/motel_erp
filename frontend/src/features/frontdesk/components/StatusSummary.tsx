import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { RoomStatusSummary } from '@/features/frontdesk/types'
import type { RoomStatus } from '@/types/api'

const DOT: Record<RoomStatus, string> = {
  AVAILABLE: 'bg-status-available',
  RESERVED: 'bg-brand-accent',
  OCCUPIED: 'bg-status-occupied',
  CLEANING: 'bg-status-cleaning',
  MAINTENANCE: 'bg-status-maintenance',
  BLOCKED: 'bg-status-maintenance',
}

interface Props {
  data: RoomStatusSummary[] | undefined
  isLoading: boolean
  activeStatus: string | null
  onFilter: (status: string | null) => void
}

function Tile({
  label,
  value,
  dot,
  active,
  hint,
  onClick,
}: {
  label: string
  value: number
  dot?: string
  active: boolean
  hint?: string
  onClick: () => void
}) {
  return (
    <Card
      asChild
      className={cn(
        'cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md',
        'active:translate-y-0 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
        active && 'border-foreground/30 ring-1 ring-foreground/10',
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={active} className="text-left">
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden /> : null}
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular">
            {value}
          </p>
          {hint ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
        </div>
      </button>
    </Card>
  )
}

/** Conteo por estado; cada tarjeta filtra el grid al pulsarla. */
export function StatusSummary({ data, isLoading, activeStatus, onFilter }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.25rem] rounded-xl" />
        ))}
      </div>
    )
  }

  const rows = data ?? []
  const total = rows.reduce((sum, item) => sum + item.count, 0)
  const occupied = rows.find((item) => item.status === 'OCCUPIED')?.count ?? 0
  const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="Total"
        value={total}
        active={activeStatus === null}
        hint={`${occupancy}% de ocupación`}
        onClick={() => onFilter(null)}
      />

      {rows
        .filter((item) => item.count > 0 || item.status === 'AVAILABLE')
        .map((item) => (
          <Tile
            key={item.status}
            label={item.status_display}
            value={item.count}
            dot={DOT[item.status]}
            active={activeStatus === item.status}
            onClick={() => onFilter(item.status === activeStatus ? null : item.status)}
          />
        ))}
    </div>
  )
}
