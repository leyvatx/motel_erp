import { formatMoney, formatQuantity } from '@/lib/format'

export function ReportBars({
  rows,
  money = false,
}: {
  rows: { label: string; value: number }[]
  money?: boolean
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  if (!rows.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay datos en este periodo.
      </p>
    )
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{row.label}</span>
          <div className="h-7 overflow-hidden rounded-md bg-muted">
            <div
              className="h-full min-w-1 rounded-md bg-primary/75"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <span className="min-w-16 text-right font-medium tabular">
            {money ? formatMoney(row.value) : formatQuantity(row.value)}
          </span>
        </div>
      ))}
    </div>
  )
}
