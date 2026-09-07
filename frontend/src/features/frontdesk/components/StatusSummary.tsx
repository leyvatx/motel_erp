import type { IconType } from 'react-icons'
import { LuBed, LuDoorOpen, LuLayoutGrid, LuSparkles, LuWrench } from 'react-icons/lu'

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

const ICONO: Partial<Record<RoomStatus, IconType>> = {
  OCCUPIED: LuBed,
  AVAILABLE: LuDoorOpen,
  CLEANING: LuSparkles,
  MAINTENANCE: LuWrench,
  BLOCKED: LuWrench,
}

/** Orden de lectura del turno: cuánto se está usando, cuánto queda libre y
 *  cuánto está por rotar. Los demás estados van después y solo si los hay: en
 *  la mayoría de los turnos son cero y ocuparían fichas vacías. */
const FIJOS: RoomStatus[] = ['OCCUPIED', 'AVAILABLE', 'CLEANING']
const DESPUES: RoomStatus[] = ['RESERVED', 'MAINTENANCE', 'BLOCKED']

interface Props {
  data: RoomStatusSummary[] | undefined
  isLoading: boolean
  activeStatus: string | null
  onFilter: (status: string | null) => void
}

/** Una ficha de métrica: punto de color, número y -- si cabe -- su etiqueta.
 *
 *  En el teléfono se queda el punto y el número, que es lo único que se lee de
 *  reojo; la palabra vuelve a partir de `sm`. Cada ficha filtra la cuadrícula,
 *  así que la altura mínima es la del pulgar, no la del texto. */
function Chip({
  label,
  value,
  percent,
  dot,
  icon: Icono,
  active,
  onClick,
}: {
  label: string
  value: number
  percent: number | null
  dot?: string
  icon?: IconType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={percent === null ? `${label}: ${value}` : `${label}: ${value}, ${percent}%`}
      title={percent === null ? label : `${label} · ${percent}%`}
      className={cn(
        'inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-lg border px-2.5 sm:h-9',
        'border-border/60 bg-card transition-colors duration-150',
        'hover:border-foreground/20 hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'border-foreground/30 bg-accent',
      )}
    >
      {dot ? (
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      ) : Icono ? (
        <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}

      <span className="font-mono text-base font-semibold leading-none tabular tracking-tight">
        {value}
      </span>

      <span className="hidden text-xs leading-none text-muted-foreground sm:inline" aria-hidden>
        {label}
      </span>

      {percent !== null ? (
        <span
          className="hidden font-mono text-2xs leading-none tabular text-muted-foreground lg:inline"
          aria-hidden
        >
          {percent}%
        </span>
      ) : null}
    </button>
  )
}

export function StatusSummary({ data, isLoading, activeStatus, onFilter }: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-24 rounded-lg sm:h-9" />
        ))}
      </div>
    )
  }

  const rows = data ?? []
  const total = rows.reduce((sum, item) => sum + item.count, 0)
  const fila = (status: RoomStatus): RoomStatusSummary | undefined =>
    rows.find((item) => item.status === status)
  const porcentaje = (valor: number): number | null =>
    total > 0 ? Math.round((valor / total) * 100) : null

  const visibles: RoomStatus[] = [
    ...FIJOS,
    ...DESPUES.filter((status) => (fila(status)?.count ?? 0) > 0),
  ]

  return (
    // En el teléfono es un carrusel: las fichas se deslizan con el dedo en vez
    // de apilarse y robarle tres renglones a la cuadrícula.
    <div
      className={cn(
        '-mx-1 flex snap-x snap-mandatory items-center gap-1.5 overflow-x-auto px-1 pb-1',
        'scrollbar-none sm:mx-0 sm:snap-none sm:overflow-x-visible sm:px-0 sm:pb-0',
      )}
      role="group"
      aria-label="Ocupación por estado"
    >
      <Chip
        label="Total"
        value={total}
        percent={null}
        icon={LuLayoutGrid}
        active={activeStatus === null}
        onClick={() => onFilter(null)}
      />

      {visibles.map((status) => {
        const item = fila(status)
        const valor = item?.count ?? 0
        return (
          <Chip
            key={status}
            label={item?.status_display ?? status}
            value={valor}
            percent={porcentaje(valor)}
            dot={DOT[status]}
            icon={ICONO[status]}
            active={activeStatus === status}
            onClick={() => onFilter(status === activeStatus ? null : status)}
          />
        )
      })}
    </div>
  )
}
