import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  ClipboardCheck,
  Eye,
  PackagePlus,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { StatStrip } from '@/components/layout/StatStrip'
import { Pagination } from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { RowActions, useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  MovementDialog,
  type MovementMode,
} from '@/features/inventory/components/MovementDialog'
import { ProductDetailDialog } from '@/features/inventory/components/ProductDetailDialog'
import {
  useExpiringLots,
  useLowStock,
  useStocks,
  useWarehouses,
} from '@/features/inventory/hooks'
import type { WarehouseStock } from '@/features/inventory/types'
import { formatDate, formatQuantity, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type View = 'all' | 'low' | 'expiring'

export default function InventoryPage() {
  const [movement, setMovement] = useState<MovementMode | null>(null)
  const [detail, setDetail] = useState<WarehouseStock | null>(null)
  const [search, setSearch] = useState('')
  const [warehouse, setWarehouse] = useState<string>('all')
  const [view, setView] = useState<View>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const warehouses = useWarehouses()
  const stocks = useStocks({
    search: search || undefined,
    warehouse: warehouse === 'all' ? undefined : Number(warehouse),
    page,
    page_size: pageSize,
  })
  const lowStock = useLowStock()
  const lots = useExpiringLots(15)
  const openContextMenu = useRowContextMenu()

  const rows = useMemo(() => {
    const all = stocks.data?.results ?? []
    const ordered = [...all].sort((a, b) => {
      if (a.is_below_minimum !== b.is_below_minimum) return a.is_below_minimum ? -1 : 1
      return a.product_name.localeCompare(b.product_name)
    })
    if (view === 'low') return ordered.filter((row) => row.is_below_minimum)
    return ordered
  }, [stocks.data, view])

  const lowCount = lowStock.data?.count ?? 0
  const expiringCount = lots.data?.count ?? 0

  const actionsFor = (row: WarehouseStock): RowAction[] => [
    {
      key: 'detail',
      label: 'Ver ficha y Kardex',
      icon: <Eye />,
      onSelect: () => setDetail(row),
    },
    {
      key: 'entry',
      label: 'Registrar entrada',
      icon: <PackagePlus />,
      separated: true,
      onSelect: () => setMovement('entry'),
    },
    {
      key: 'transfer',
      label: 'Traspasar a otro almacén',
      icon: <ArrowLeftRight />,
      onSelect: () => setMovement('transfer'),
    },
    {
      key: 'adjust',
      label: 'Ajustar por conteo',
      icon: <ClipboardCheck />,
      onSelect: () => setMovement('adjust'),
    },
    {
      key: 'waste',
      label: 'Registrar merma',
      icon: <Trash2 />,
      danger: true,
      separated: true,
      onSelect: () => setMovement('waste'),
    },
  ]

  return (
    <PageShell
      title="Inventarios"
      description="Existencias por almacén, con lo crítico al frente."
      actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus />
                Registrar movimiento
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setMovement('entry')}>
                <PackagePlus />
                Entrada de mercancía
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMovement('transfer')}>
                <ArrowLeftRight />
                Traspaso entre almacenes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMovement('adjust')}>
                <ClipboardCheck />
                Ajuste por conteo físico
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setMovement('waste')}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 />
                Merma o caducidad
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      toolbar={
          <StatStrip
          isLoading={stocks.isLoading}
          stats={[
            {
              label: 'Existencias listadas',
              value: stocks.data?.count ?? 0,
              help: warehouse === 'all' ? 'todos los almacenes' : 'almacén filtrado',
              onClick: () => setView('all'),
              active: view === 'all',
            },
            {
              label: 'Bajo mínimo',
              value: lowCount,
              tone: lowCount > 0 ? 'danger' : 'positive',
              help: lowCount > 0 ? 'requieren resurtido' : 'todo por encima del mínimo',
              onClick: () => setView('low'),
              active: view === 'low',
            },
            {
              label: 'Por caducar',
              value: expiringCount,
              tone: expiringCount > 0 ? 'warning' : 'neutral',
              help: 'próximos 15 días',
              onClick: () => setView('expiring'),
              active: view === 'expiring',
            },
            {
              label: 'Almacenes',
              value: warehouses.data?.count ?? 0,
              help: 'activos',
            },
          ]}
        />
      }
    >
      <Card className="min-h-0 flex-1">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="h-9 max-w-xs"
            />
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los almacenes</SelectItem>
                {(warehouses.data?.results ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {view !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={() => setView('all')}>
                <SlidersHorizontal />
                Quitar filtro
              </Button>
            ) : null}

            <span className="ml-auto text-xs text-muted-foreground">
              Clic derecho sobre un renglón para sus acciones
            </span>
          </div>

          {view === 'expiring' ? (
            <ExpiringTable rows={lots.data?.results ?? []} isLoading={lots.isLoading} />
          ) : stocks.isLoading ? (
            <Skeleton className="min-h-0 flex-1 rounded-lg" />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              <TableScroll>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Existencia</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="w-[52px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableEmpty
                      colSpan={5}
                      message={
                        view === 'low'
                          ? 'Ningún producto está bajo su mínimo.'
                          : 'Sin existencias que coincidan con la búsqueda.'
                      }
                    />
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        onClick={() => setDetail(row)}
                        onContextMenu={openContextMenu(row.product_name, actionsFor(row))}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.is_below_minimum ? (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-occupied"
                                aria-hidden
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{row.product_name}</p>
                              <p className="truncate font-mono text-2xs text-muted-foreground">
                                {row.product_sku}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.warehouse_name}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular font-semibold',
                            row.is_below_minimum && 'text-status-occupied',
                          )}
                        >
                          {formatQuantity(row.quantity)}
                          {row.is_below_minimum ? (
                            <span className="ml-2 text-2xs font-normal text-status-occupied">
                              faltan {formatQuantity(toNumber(row.min_stock) - toNumber(row.quantity))}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {formatQuantity(row.min_stock)}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions items={actionsFor(row)} label={row.product_name} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </TableScroll>

              <Pagination
                page={stocks.data?.page ?? 1}
                pageSize={pageSize}
                count={stocks.data?.count ?? 0}
                totalPages={stocks.data?.total_pages ?? 1}
                isFetching={stocks.isFetching}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <MovementDialog mode={movement} onOpenChange={(open) => !open && setMovement(null)} />
      <ProductDetailDialog stock={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </PageShell>
  )
}

function ExpiringTable({
  rows,
  isLoading,
}: {
  rows: { id: number; product_name: string; lot_code: string; warehouse_name: string; expiration_date: string | null; quantity: string; is_expired: boolean }[]
  isLoading: boolean
}) {
  if (isLoading) return <Skeleton className="min-h-0 flex-1 rounded-lg" />

  return (
    <div className="min-h-0 flex-1 overflow-auto scrollbar-thin rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Almacén</TableHead>
            <TableHead>Caduca</TableHead>
            <TableHead className="text-right">Existencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={5} message="Sin lotes próximos a caducar." />
          ) : (
            rows.map((lot) => (
              <TableRow key={lot.id}>
                <TableCell className="font-medium">{lot.product_name}</TableCell>
                <TableCell className="font-mono text-xs">{lot.lot_code || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{lot.warehouse_name}</TableCell>
                <TableCell>
                  {lot.is_expired ? (
                    <Badge variant="occupied">Caducado {formatDate(lot.expiration_date)}</Badge>
                  ) : (
                    <span>{formatDate(lot.expiration_date)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatQuantity(lot.quantity)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
