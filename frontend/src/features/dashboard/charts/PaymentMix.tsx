import { formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Shift } from '@/features/finances/types'

/**
 * Reparto del cobro del turno en una sola barra apilada.
 *
 * No pide nada al servidor: cash_sales, card_sales y transfer_sales ya vienen
 * en el turno que el panel carga de todos modos. Va dentro de la franja y no en
 * su propia tarjeta porque el problema que vinimos a resolver era el alto.
 */
const METODOS = [
  { campo: 'cash_sales', label: 'Efectivo', token: '--status-available' },
  { campo: 'card_sales', label: 'Tarjeta', token: '--brand-accent' },
  { campo: 'transfer_sales', label: 'Transfer.', token: '--status-cleaning' },
] as const

export function PaymentMix({ shift, className }: { shift?: Shift | null; className?: string }) {
  if (!shift) return null

  const partes = METODOS.map((metodo) => ({
    ...metodo,
    monto: toNumber(shift[metodo.campo]),
  }))
  const total = partes.reduce((suma, parte) => suma + parte.monto, 0)
  if (total <= 0) return null

  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">Cómo se cobró</p>

      <div
        className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={partes
          .filter((parte) => parte.monto > 0)
          .map((parte) => `${parte.label}: ${formatMoney(parte.monto)}`)
          .join(', ')}
      >
        {partes
          .filter((parte) => parte.monto > 0)
          .map((parte) => (
            <span
              key={parte.campo}
              style={{
                width: `${(parte.monto / total) * 100}%`,
                background: `hsl(var(${parte.token}))`,
              }}
            />
          ))}
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {partes.map((parte) => (
          <li key={parte.campo} className="flex items-center gap-1 text-2xs text-muted-foreground">
            <span
              className="size-1.5 rounded-full"
              style={{ background: `hsl(var(${parte.token}))` }}
              aria-hidden
            />
            {parte.label}
            <span className="font-medium tabular text-foreground">{formatMoney(parte.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
