import { PiPackage } from 'react-icons/pi'

import { RowActions, type RowAction } from '@/components/ui/row-actions'
import { EmptyState } from '@/components/ui/states'
import type { WarehouseStock } from '@/features/inventory/types'
import { formatQuantity, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  rows: WarehouseStock[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
  onDetail: (row: WarehouseStock) => void
  actionsFor: (row: WarehouseStock) => RowAction[]
}

/**
 * Existencias en el teléfono: una tarjeta por producto, no una tabla de cinco
 * columnas.
 *
 * Una tabla en 375 px obliga a hacer zoom o a desplazarse en horizontal, y a
 * quien está contando cajas en la bodega eso le cuesta más que la información
 * que gana. Aquí solo lo que decide algo de pie frente al anaquel: qué es,
 * cuánto hay, si está por debajo del mínimo y qué hacer. El resto -- almacén,
 * kardex, costos -- vive en la ficha, a un toque.
 */
export function StockCards({
  rows,
  isLoading,
  emptyTitle,
  emptyDescription,
  onDetail,
  actionsFor,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[4.5rem] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<PiPackage className="h-8 w-8" aria-hidden />}
      />
    )
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const faltante = toNumber(row.min_stock) - toNumber(row.quantity)

        return (
          <li
            key={row.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border bg-card p-3',
              row.is_below_minimum && 'border-status-occupied/40 bg-status-occupied/[0.04]',
            )}
          >
            <button
              type="button"
              onClick={() => onDetail(row)}
              className="min-h-[2.75rem] min-w-0 flex-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <p className="truncate font-medium">{row.product_name}</p>
              <p className="truncate text-2xs text-muted-foreground">{row.warehouse_name}</p>
            </button>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  'text-lg font-semibold leading-none tabular',
                  row.is_below_minimum && 'text-status-occupied',
                )}
              >
                {formatQuantity(row.quantity)}
              </p>
              {/* "faltan 0" no dice nada: cuando la existencia toca el mínimo
                  exacto el producto ya está en alerta, pero no falta nada
                  todavía. Lo que hay que comunicar es que se acabó el colchón. */}
              {row.is_below_minimum ? (
                <p className="mt-1 text-2xs text-status-occupied">
                  {faltante > 0 ? `faltan ${formatQuantity(faltante)}` : 'en el mínimo'}
                </p>
              ) : (
                <p className="mt-1 text-2xs text-muted-foreground">
                  mín. {formatQuantity(row.min_stock)}
                </p>
              )}
            </div>

            <RowActions items={actionsFor(row)} label={row.product_name} />
          </li>
        )
      })}
    </ul>
  )
}
