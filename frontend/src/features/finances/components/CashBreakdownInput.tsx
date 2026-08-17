import { useMemo } from 'react'

import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format'
import type { CashBreakdown } from '@/features/finances/types'
import { cn } from '@/lib/utils'

const DENOMINATIONS = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '0.50']

interface Props {
  value: CashBreakdown
  onChange: (next: CashBreakdown) => void
  total: number
  label?: string
}

export function CashBreakdownInput({ value, onChange, total, label = 'Total contado' }: Props) {
  const filled = useMemo(() => Object.keys(value).length, [value])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {DENOMINATIONS.map((denomination) => {
          const count = value[denomination] ?? 0
          return (
            <label
              key={denomination}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors',
                count > 0 ? 'border-foreground/20 bg-accent/50' : 'bg-card',
              )}
            >
              <span className="w-12 shrink-0 text-xs font-medium tabular text-muted-foreground">
                ${denomination}
              </span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={count || ''}
                placeholder="0"
                onChange={(event) => {
                  const next = { ...value }
                  const quantity = Number(event.target.value)
                  if (!quantity) delete next[denomination]
                  else next[denomination] = quantity
                  onChange(next)
                }}
                className="h-8 border-0 bg-transparent px-1 text-right shadow-none focus-visible:ring-0"
              />
            </label>
          )
        })}
      </div>

      <div className="flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          {label}
          {filled > 0 ? (
            <span className="ml-1 text-2xs">({filled} denominaciones)</span>
          ) : null}
        </span>
        <span className="text-xl font-semibold tabular">{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export function breakdownTotal(value: CashBreakdown): number {
  return Object.entries(value).reduce(
    (sum, [denomination, count]) => sum + Number(denomination) * (count || 0),
    0,
  )
}
