import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/format'
import type { ShiftTrendHour } from '@/features/finances/types'

interface Props {
  hours: ShiftTrendHour[]
  loading?: boolean
}

function Etiqueta({ active, payload, label }: {
  active?: boolean
  payload?: { payload: ShiftTrendHour }[]
  label?: string
}) {
  const punto = payload?.[0]?.payload
  if (!active || !punto) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-sm font-semibold tabular">{formatMoney(punto.sales)}</p>
      <p className="text-2xs text-muted-foreground">
        {punto.rentals} {punto.rentals === 1 ? 'renta' : 'rentas'}
      </p>
    </div>
  )
}

export function ShiftTrendChart({ hours, loading }: Props) {
  if (loading) return <Skeleton className="h-full min-h-32 w-full" />

  if (hours.length === 0) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">
          Sin turno abierto. La tendencia aparece al abrir caja.
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={hours} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="ventasTurno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-accent))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(var(--brand-accent))" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          yAxisId="dinero"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(valor: number) =>
            valor >= 1000 ? `${Math.round(valor / 1000)}k` : `${valor}`
          }
        />
        <YAxis
          yAxisId="rentas"
          orientation="right"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={26}
          allowDecimals={false}
        />
        <Tooltip content={<Etiqueta />} cursor={{ stroke: 'hsl(var(--border))' }} />
        <Legend
          verticalAlign="top"
          height={22}
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
        <Bar
          yAxisId="rentas"
          dataKey="rentals"
          name="Rentas"
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.25}
          barSize={10}
          isAnimationActive={false}
        />
        <Area
          yAxisId="dinero"
          type="monotone"
          dataKey={(fila: ShiftTrendHour) => Number(fila.sales)}
          name="Ventas"
          stroke="hsl(var(--brand-accent))"
          strokeWidth={2}
          fill="url(#ventasTurno)"
          isAnimationActive={false}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
