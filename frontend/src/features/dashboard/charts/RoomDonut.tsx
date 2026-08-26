import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import type { RoomStatus } from '@/types/api'

/** Los colores salen de las mismas variables que pintan el grid de recepción.
 *  Recharts necesita un color resuelto, no una clase, así que se leen del tema
 *  en vez de escribirlos aquí: si mañana cambia el tema, el anillo lo sigue. */
const TOKENS: Partial<Record<RoomStatus, string>> = {
  AVAILABLE: '--status-available',
  OCCUPIED: '--status-occupied',
  CLEANING: '--status-cleaning',
  RESERVED: '--primary',
  MAINTENANCE: '--status-maintenance',
  BLOCKED: '--muted-foreground',
}

export interface RoomSlice {
  status: RoomStatus
  status_display: string
  count: number
}

interface Props {
  data: RoomSlice[]
  total: number
  loading?: boolean
}

export function RoomDonut({ data, total, loading }: Props) {
  // Una rebanada en cero le mete a Recharts un sector de ángulo nulo que aun
  // así dibuja su borde: una rayita suelta sobre el anillo.
  const slices = useMemo(() => data.filter((item) => item.count > 0), [data])

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="aspect-square h-full max-h-44 min-h-28 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aún no hay habitaciones configuradas.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {/* Escala con el alto de su celda en vez de quedarse fijo: la fila del
          bento es 1fr y en una pantalla alta un anillo de 128px dejaría un
          hueco muerto alrededor. El max evita el efecto contrario. */}
      <div className="relative aspect-square h-full max-h-44 min-h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="status_display"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((item) => (
                <Cell
                  key={item.status}
                  fill={`hsl(var(${TOKENS[item.status] ?? '--muted-foreground'}))`}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* El total va en el hueco del anillo: es el dato que más se busca y
            así no gasta un renglón aparte. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none tabular">{total}</span>
          <span className="text-2xs text-muted-foreground">cuartos</span>
        </div>
      </div>

      {/* Leyenda a la derecha, no abajo: el panel anda sobrado de ancho y corto
          de alto, que es justo el problema que vinimos a resolver. */}
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {data.map((item) => (
          <li key={item.status} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: `hsl(var(${TOKENS[item.status] ?? '--muted-foreground'}))` }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {item.status_display}
            </span>
            <span className="shrink-0 font-medium tabular">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
