import type { IconType } from 'react-icons'
import { LuBed, LuDoorOpen, LuLayoutGrid, LuSparkles } from 'react-icons/lu'

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

/** Los cuatro números que se miran de reojo cada media hora.
 *
 *  El resto de los estados -- reservada, mantenimiento, bloqueada -- sigue
 *  abajo como filtro, pero no compite por el espacio de arriba: son excepciones
 *  y no cambian la decisión de nadie durante el turno.
 */
const DESTACADOS = [
  { key: 'TOTAL', label: 'Total', icon: LuLayoutGrid },
  { key: 'OCCUPIED', label: 'Ocupadas', icon: LuBed },
  { key: 'AVAILABLE', label: 'Libres', icon: LuDoorOpen },
  { key: 'CLEANING', label: 'Por limpiar', icon: LuSparkles },
] as const

const SECUNDARIOS: RoomStatus[] = ['RESERVED', 'MAINTENANCE', 'BLOCKED']

interface Props {
  data: RoomStatusSummary[] | undefined
  isLoading: boolean
  activeStatus: string | null
  onFilter: (status: string | null) => void
}

function Tile({
  label,
  value,
  percent,
  icon: Icon,
  dot,
  active,
  onClick,
}: {
  label: string
  value: number
  /** Porcentaje sobre el total de habitaciones. ``null`` en la tarjeta Total. */
  percent: number | null
  icon: IconType
  dot?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Card
      asChild
      className={cn(
        'border-border/60 transition-colors duration-150',
        'hover:border-foreground/20 hover:bg-accent/30',
        'focus-within:border-foreground/25',
        active && 'border-foreground/30 bg-accent/40',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'cursor-pointer text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
      >
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden /> : null}
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <Icon className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold leading-none tracking-tightest tabular">{value}</p>
            {percent !== null ? (
              <span className="text-xs font-medium leading-none tabular text-muted-foreground">
                {percent}%
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </Card>
  )
}

export function StatusSummary({ data, isLoading, activeStatus, onFilter }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
    )
  }

  const rows = data ?? []
  const total = rows.reduce((sum, item) => sum + item.count, 0)
  const cuenta = (status: RoomStatus): number =>
    rows.find((item) => item.status === status)?.count ?? 0
  const porcentaje = (value: number): number => (total > 0 ? Math.round((value / total) * 100) : 0)

  const secundarios = rows.filter((item) => SECUNDARIOS.includes(item.status) && item.count > 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DESTACADOS.map((tile) => {
          const esTotal = tile.key === 'TOTAL'
          const value = esTotal ? total : cuenta(tile.key)
          return (
            <Tile
              key={tile.key}
              label={tile.label}
              value={value}
              percent={esTotal ? null : porcentaje(value)}
              icon={tile.icon}
              dot={esTotal ? undefined : DOT[tile.key]}
              active={esTotal ? activeStatus === null : activeStatus === tile.key}
              onClick={() => onFilter(esTotal || activeStatus === tile.key ? null : tile.key)}
            />
          )
        })}
      </div>

      {secundarios.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {secundarios.map((item) => (
            <button
              key={item.status}
              type="button"
              aria-pressed={activeStatus === item.status}
              onClick={() => onFilter(item.status === activeStatus ? null : item.status)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs',
                'transition-colors duration-150 hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeStatus === item.status && 'border-foreground/30 bg-accent',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', DOT[item.status])} aria-hidden />
              {item.status_display}
              <span className="font-medium tabular">{item.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
