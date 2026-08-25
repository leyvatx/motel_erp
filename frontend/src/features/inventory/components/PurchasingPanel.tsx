import { useEffect, useMemo, useState } from 'react'
import { PiEye, PiPaperPlaneTilt, PiPlus, PiProhibit, PiSealCheck, PiTruck } from 'react-icons/pi'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { RowActions, type RowAction } from '@/components/ui/row-actions'
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
  useCancelPurchase,
  useCreatePurchase,
  useCreateSupplier,
  useProducts,
  usePurchases,
  useReceivePurchase,
  useSubmitPurchase,
  useSuppliers,
  useWarehouses,
} from '@/features/inventory/hooks'
import type { PurchaseOrder, PurchaseStatus } from '@/features/inventory/types'
import { formatDate, formatMoney, formatQuantity, toNumber } from '@/lib/format'

const statusVariant: Record<
  PurchaseStatus,
  'secondary' | 'maintenance' | 'available' | 'occupied'
> = {
  DRAFT: 'secondary',
  ORDERED: 'maintenance',
  PARTIAL: 'maintenance',
  RECEIVED: 'available',
  CANCELLED: 'occupied',
}

export function PurchasingPanel() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null)
  const [detail, setDetail] = useState<PurchaseOrder | null>(null)
  const purchases = usePurchases({
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    page,
    page_size: 25,
  })
  const submit = useSubmitPurchase()
  const cancel = useCancelPurchase()

  const actions = (order: PurchaseOrder): RowAction[] => {
    const result: RowAction[] = [
      {
        key: 'detail',
        label: 'Ver detalle',
        icon: <PiEye />,
        onSelect: () => setDetail(order),
      },
    ]
    if (order.status === 'DRAFT') {
      result.push({
        key: 'submit',
        label: 'Enviar al proveedor',
        icon: <PiPaperPlaneTilt />,
        onSelect: () => submit.mutate(order.id),
      })
    }
    if (order.status === 'ORDERED' || order.status === 'PARTIAL') {
      result.push({
        key: 'receive',
        label: 'Recibir mercancía',
        icon: <PiSealCheck />,
        onSelect: () => setReceiving(order),
      })
    }
    if (order.status === 'DRAFT' || order.status === 'ORDERED') {
      result.push({
        key: 'cancel',
        label: 'Cancelar compra',
        icon: <PiProhibit />,
        danger: true,
        separated: true,
        onSelect: () => cancel.mutate(order.id),
      })
    }
    return result
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Buscar folio o proveedor..."
          className="h-9 max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="DRAFT">Borradores</SelectItem>
            <SelectItem value="ORDERED">Enviadas</SelectItem>
            <SelectItem value="PARTIAL">Recepción parcial</SelectItem>
            <SelectItem value="RECEIVED">Recibidas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSupplierOpen(true)}>
            <PiTruck /> Nuevo proveedor
          </Button>
          <Button size="sm" onClick={() => setPurchaseOpen(true)}>
            <PiPlus /> Nueva compra
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {purchases.isLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(purchases.data?.results ?? []).length === 0 ? (
                  <TableEmpty colSpan={6} message="No hay compras que coincidan con los filtros." />
                ) : (
                  purchases.data?.results.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => setDetail(order)}
                    >
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{order.folio}</p>
                        <p className="text-2xs text-muted-foreground">
                          {formatDate(order.order_date)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{order.supplier_name}</p>
                        <p className="text-2xs text-muted-foreground">
                          Destino: {order.warehouse_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        {order.expected_date ? formatDate(order.expected_date) : 'Sin fecha'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status]}>{order.status_display}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular">
                        {formatMoney(order.total)}
                      </TableCell>
                      <TableCell>
                        <RowActions items={actions(order)} label={order.folio} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <Pagination
            page={purchases.data?.page ?? 1}
            pageSize={25}
            count={purchases.data?.count ?? 0}
            totalPages={purchases.data?.total_pages ?? 1}
            isFetching={purchases.isFetching}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <SupplierDialog open={supplierOpen} onOpenChange={setSupplierOpen} />
      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      <ReceiveDialog order={receiving} onOpenChange={(open) => !open && setReceiving(null)} />
      <PurchaseDetailDialog order={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  )
}

function PurchaseDetailDialog({
  order,
  onOpenChange,
}: {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
}) {
  if (!order) return null
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {order.folio} · {order.supplier_name}
          </DialogTitle>
          <DialogDescription>
            Orden del {formatDate(order.order_date)} para {order.warehouse_name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={statusVariant[order.status]}>{order.status_display}</Badge>
          {order.expected_date ? (
            <span className="text-muted-foreground">
              Entrega: {formatDate(order.expected_date)}
            </span>
          ) : null}
          {order.supplier_reference ? (
            <span className="text-muted-foreground">Referencia: {order.supplier_reference}</span>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Solicitado</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="font-mono text-2xs text-muted-foreground">{item.product_sku}</p>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatQuantity(item.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatQuantity(item.received_quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatQuantity(item.pending_quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatMoney(item.line_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-right">{formatMoney(order.subtotal)}</span>
          <span className="text-muted-foreground">Impuestos</span>
          <span className="text-right">{formatMoney(order.tax_total)}</span>
          <strong>Total</strong>
          <strong className="text-right">{formatMoney(order.total)}</strong>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SupplierDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateSupplier()
  const [form, setForm] = useState({
    code: '',
    business_name: '',
    tax_id: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    payment_terms_days: 0,
    notes: '',
  })
  useEffect(() => {
    if (open)
      setForm({
        code: '',
        business_name: '',
        tax_id: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
        payment_terms_days: 0,
        notes: '',
      })
  }, [open])
  const field = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
          <DialogDescription>Este catálogo es independiente para cada motel.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate(form, { onSuccess: () => onOpenChange(false) })
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Clave</Label>
              <Input
                value={form.code}
                onChange={(e) => field('code', e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Razón social</Label>
              <Input
                value={form.business_name}
                onChange={(e) => field('business_name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>RFC</Label>
              <Input
                value={form.tax_id}
                onChange={(e) => field('tax_id', e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => field('contact_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => field('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => field('email', e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => field('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Días de crédito</Label>
              <Input
                type="number"
                min="0"
                value={form.payment_terms_days}
                onChange={(e) => field('payment_terms_days', Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Guardar proveedor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type DraftItem = {
  key: number
  product: string
  quantity: string
  unit_cost: string
  tax_rate: string
}

function PurchaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const suppliers = useSuppliers({ page_size: 100 })
  const warehouses = useWarehouses()
  const products = useProducts({ page_size: 100 })
  const create = useCreatePurchase()
  const [supplier, setSupplier] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [expected, setExpected] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  useEffect(() => {
    if (!open) return
    setSupplier('')
    setWarehouse('')
    setExpected('')
    setReference('')
    setNotes('')
    setItems([{ key: Date.now(), product: '', quantity: '1', unit_cost: '0', tax_rate: '0.16' }])
  }, [open])
  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + toNumber(item.quantity) * toNumber(item.unit_cost) * (1 + toNumber(item.tax_rate)),
        0,
      ),
    [items],
  )
  const changeItem = (key: number, field: keyof DraftItem, value: string) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    )
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!supplier || !warehouse || items.some((item) => !item.product)) return
    create.mutate(
      {
        supplier: Number(supplier),
        warehouse: Number(warehouse),
        order_date: new Date().toISOString().slice(0, 10),
        expected_date: expected || null,
        supplier_reference: reference,
        notes,
        items: items.map((item) => ({
          product: Number(item.product),
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          tax_rate: item.tax_rate,
        })),
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>
            Guárdala como borrador y envíala cuando esté confirmada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Proveedor</Label>
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.data?.results.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Almacén destino</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.data?.results.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entrega esperada</Label>
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Referencia del proveedor</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_120px_90px_36px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Costo unitario</span>
              <span>Impuesto</span>
              <span />
            </div>
            {items.map((item) => (
              <div key={item.key} className="grid grid-cols-[1fr_100px_120px_90px_36px] gap-2">
                <Select
                  value={item.product}
                  onValueChange={(value) => changeItem(item.key, 'product', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.data?.results.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.sku} · {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantity}
                  onChange={(e) => changeItem(item.key, 'quantity', e.target.value)}
                  required
                />
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={item.unit_cost}
                  onChange={(e) => changeItem(item.key, 'unit_cost', e.target.value)}
                  required
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.tax_rate}
                  onChange={(e) => changeItem(item.key, 'tax_rate', e.target.value)}
                  required
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) => current.filter((row) => row.key !== item.key))
                  }
                >
                  <PiProhibit />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { key: Date.now(), product: '', quantity: '1', unit_cost: '0', tax_rate: '0.16' },
                ])
              }
            >
              <PiPlus /> Agregar producto
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Total estimado</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || !supplier || !warehouse}>
              Guardar borrador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReceiveDialog({
  order,
  onOpenChange,
}: {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
}) {
  const receive = useReceivePurchase()
  const products = useProducts({ page_size: 100 })
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [lots, setLots] = useState<Record<number, string>>({})
  const [dates, setDates] = useState<Record<number, string>>({})
  useEffect(() => {
    if (order)
      setAmounts(
        Object.fromEntries(
          order.items
            .filter((item) => toNumber(item.pending_quantity) > 0)
            .map((item) => [item.id, item.pending_quantity]),
        ),
      )
  }, [order])
  if (!order) return null
  const pending = order.items.filter((item) => toNumber(item.pending_quantity) > 0)
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recibir {order.folio}</DialogTitle>
          <DialogDescription>
            Las cantidades recibidas entrarán a {order.warehouse_name} y quedarán en el Kardex.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {pending.map((item) => {
            const product = products.data?.results.find((entry) => entry.id === item.product)
            return (
              <div
                key={item.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px_130px_150px]"
              >
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Pendiente: {formatQuantity(item.pending_quantity)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Recibir</Label>
                  <Input
                    type="number"
                    min="0"
                    max={item.pending_quantity}
                    step="0.001"
                    value={amounts[item.id] ?? ''}
                    onChange={(e) =>
                      setAmounts((current) => ({ ...current, [item.id]: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Lote</Label>
                  <Input
                    value={lots[item.id] ?? ''}
                    onChange={(e) =>
                      setLots((current) => ({ ...current, [item.id]: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    Caducidad {product?.track_expiration ? '*' : ''}
                  </Label>
                  <Input
                    type="date"
                    value={dates[item.id] ?? ''}
                    onChange={(e) =>
                      setDates((current) => ({ ...current, [item.id]: e.target.value }))
                    }
                    required={product?.track_expiration}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={receive.isPending || pending.every((item) => toNumber(amounts[item.id]) <= 0)}
            onClick={() =>
              receive.mutate(
                {
                  id: order.id,
                  payload: {
                    items: pending
                      .filter((item) => toNumber(amounts[item.id]) > 0)
                      .map((item) => ({
                        item_id: item.id,
                        quantity: amounts[item.id] ?? '0',
                        lot_code: lots[item.id] || '',
                        expiration_date: dates[item.id] || null,
                      })),
                  },
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            <PiSealCheck /> Registrar recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SuppliersPanel() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const suppliers = useSuppliers({ search: search || undefined, page_size: 100 })
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor..."
          className="max-w-xs"
        />
        <Button className="ml-auto" size="sm" onClick={() => setOpen(true)}>
          <PiPlus /> Nuevo proveedor
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave</TableHead>
                <TableHead>Razón social</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-40" />
                  </TableCell>
                </TableRow>
              ) : suppliers.data?.results.length ? (
                suppliers.data.results.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-mono text-xs">{supplier.code}</TableCell>
                    <TableCell>
                      <p className="font-medium">{supplier.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.tax_id || 'Sin RFC'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{supplier.contact_name || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.phone || supplier.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      {supplier.payment_terms_days
                        ? `${supplier.payment_terms_days} días`
                        : 'Contado'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={4} message="Aún no hay proveedores." />
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <SupplierDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
