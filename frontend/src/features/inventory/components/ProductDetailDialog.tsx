import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useKardex, useStocks } from '@/features/inventory/hooks'
import type { WarehouseStock } from '@/features/inventory/types'
import { formatDateTime, formatQuantity, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  stock: WarehouseStock | null
  onOpenChange: (open: boolean) => void
}

/**
 * Ficha del producto: existencias en todos los almacenes y sus últimos
 * movimientos. Es la pantalla que contesta "¿por qué hay tan poco de esto?".
 */
export function ProductDetailDialog({ stock, onOpenChange }: Props) {
  // El contenido va en un componente aparte para que sus consultas solo se
  // monten cuando hay producto: si no, se dispararían con `product=0`.
  if (!stock) return null
  return <Detail stock={stock} onOpenChange={onOpenChange} />
}

function Detail({ stock, onOpenChange }: { stock: WarehouseStock; onOpenChange: (open: boolean) => void }) {
  const stocks = useStocks({ product: stock.product, page_size: 20 })
  const kardex = useKardex({ product: stock.product, page_size: 25 })

  const total = (stocks.data?.results ?? []).reduce(
    (sum, row) => sum + toNumber(row.quantity),
    0,
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {stock.product_name}
            {stock.is_below_minimum ? <Badge variant="occupied">Bajo mínimo</Badge> : null}
          </DialogTitle>
          <DialogDescription className="font-mono">{stock.product_sku}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border px-3 py-2.5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 text-xl font-semibold tabular">{formatQuantity(total)}</p>
          </div>
          <div className="rounded-lg border px-3 py-2.5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              En {stock.warehouse_name}
            </p>
            <p
              className={cn(
                'mt-1 text-xl font-semibold tabular',
                stock.is_below_minimum && 'text-status-occupied',
              )}
            >
              {formatQuantity(stock.quantity)}
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2.5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Mínimo</p>
            <p className="mt-1 text-xl font-semibold tabular">{formatQuantity(stock.min_stock)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Existencias por almacén</p>
          <div className="rounded-lg border">
            <Table>
              <TableBody>
                {(stocks.data?.results ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-2">{row.warehouse_name}</TableCell>
                    <TableCell
                      className={cn(
                        'py-2 text-right tabular font-medium',
                        row.is_below_minimum && 'text-status-occupied',
                      )}
                    >
                      {formatQuantity(row.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Últimos movimientos</p>
          <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(kardex.data?.results ?? []).length === 0 ? (
                  <TableEmpty colSpan={4} message="Sin movimientos registrados." />
                ) : (
                  (kardex.data?.results ?? []).map((movement) => {
                    const value = toNumber(movement.signed_quantity)
                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                          {formatDateTime(movement.created_at)}
                        </TableCell>
                        <TableCell className="py-2">
                          {movement.movement_type_display}
                          {movement.reason ? (
                            <span className="block text-2xs text-muted-foreground">
                              {movement.reason}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'py-2 text-right tabular font-medium',
                            value > 0 ? 'text-status-available' : 'text-status-occupied',
                          )}
                        >
                          {value > 0 ? '+' : ''}
                          {formatQuantity(movement.signed_quantity)}
                        </TableCell>
                        <TableCell className="py-2 text-right tabular text-muted-foreground">
                          {formatQuantity(movement.balance_after)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-2xs text-muted-foreground">
          El Kardex es inmutable: una corrección se registra con un movimiento en sentido
          contrario, nunca borrando el original.
        </p>
      </DialogContent>
    </Dialog>
  )
}
