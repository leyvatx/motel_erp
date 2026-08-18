import { useState } from 'react'
import { Boxes, FolderPlus, PackagePlus, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useCreateWarehouse,
  useProducts,
  useWarehouses,
} from '@/features/inventory/hooks'
import { formatMoney, formatQuantity } from '@/lib/format'

type DialogMode = 'product' | 'category' | 'warehouse' | null

export function CatalogPanel() {
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogMode>(null)
  const products = useProducts({ search: search || undefined, page_size: 100 })
  const warehouses = useWarehouses()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar producto..."
          className="max-w-xs"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog('category')}>
            <FolderPlus /> Categoría
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('warehouse')}>
            <Boxes /> Almacén
          </Button>
          <Button size="sm" onClick={() => setDialog('product')}>
            <PackagePlus /> Producto
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Existencia</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.data?.results.length ? (
                  products.data.results.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        <p className="font-mono text-2xs text-muted-foreground">{product.sku}</p>
                      </TableCell>
                      <TableCell>{product.category_name}</TableCell>
                      <TableCell className="text-right tabular">
                        {product.is_stockable ? (
                          formatQuantity(product.total_stock ?? '0')
                        ) : (
                          <Badge variant="secondary">Servicio</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(product.sale_price)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={4} message="No hay productos." />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Almacenes</h3>
              <p className="text-xs text-muted-foreground">
                Puntos físicos o lógicos de existencia
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clave</TableHead>
                  <TableHead>Nombre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.data?.results.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-mono text-xs">{warehouse.code}</TableCell>
                    <TableCell>
                      <p>{warehouse.name}</p>
                      <p className="text-2xs text-muted-foreground">
                        {warehouse.warehouse_type_display}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <CatalogDialog mode={dialog} onOpenChange={(open) => !open && setDialog(null)} />
    </div>
  )
}

function CatalogDialog({
  mode,
  onOpenChange,
}: {
  mode: DialogMode
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {mode === 'product' ? (
          <ProductForm close={() => onOpenChange(false)} />
        ) : mode === 'category' ? (
          <CategoryForm close={() => onOpenChange(false)} />
        ) : mode === 'warehouse' ? (
          <WarehouseForm close={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({ close }: { close: () => void }) {
  const categories = useCategories()
  const create = useCreateProduct()
  const [form, setForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: '',
    unit: 'PIECE',
    sale_price: '0',
    tax_rate: '0.16',
    default_min_stock: '0',
    is_sellable: true,
    is_stockable: true,
    track_expiration: false,
  })
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))
  return (
    <>
      <DialogHeader>
        <DialogTitle>Nuevo producto o servicio</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ ...form, category: Number(form.category) }, { onSuccess: close })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={(value) => set('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {categories.data?.results.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.kind_display} · {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidad</Label>
            <Select value={form.unit} onValueChange={(value) => set('unit', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIECE">Pieza</SelectItem>
                <SelectItem value="PACK">Paquete</SelectItem>
                <SelectItem value="BOX">Caja</SelectItem>
                <SelectItem value="LITER">Litro</SelectItem>
                <SelectItem value="KILOGRAM">Kilogramo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Precio de venta</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.sale_price}
              onChange={(e) => set('sale_price', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Stock mínimo sugerido</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.default_min_stock}
              onChange={(e) => set('default_min_stock', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Código de barras</Label>
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Impuesto (0.16 = 16%)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.tax_rate}
              onChange={(e) => set('tax_rate', e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 rounded-lg border p-3 text-sm">
          <Check
            label="Controla existencias"
            checked={form.is_stockable}
            onChange={(value) => set('is_stockable', value)}
          />
          <Check
            label="Se puede vender"
            checked={form.is_sellable}
            onChange={(value) => set('is_sellable', value)}
          />
          <Check
            label="Controla caducidad"
            checked={form.track_expiration}
            onChange={(value) => set('track_expiration', value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending || !form.category}>
            <Plus /> Crear producto
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function CategoryForm({ close }: { close: () => void }) {
  const create = useCreateCategory()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('OTHER')
  return (
    <>
      <DialogHeader>
        <DialogTitle>Nueva categoría</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ name, kind, description: '', sort_order: 0 }, { onSuccess: close })
        }}
      >
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Familia</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOOD">Alimentos</SelectItem>
              <SelectItem value="BEVERAGE">Bebidas</SelectItem>
              <SelectItem value="CLEANING">Limpieza</SelectItem>
              <SelectItem value="LINEN">Blancos</SelectItem>
              <SelectItem value="AMENITY">Amenidades</SelectItem>
              <SelectItem value="SHOP">Tienda</SelectItem>
              <SelectItem value="OTHER">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Crear categoría
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function WarehouseForm({ close }: { close: () => void }) {
  const create = useCreateWarehouse()
  const [form, setForm] = useState({
    code: '',
    name: '',
    warehouse_type: 'GENERAL',
    location: '',
    is_default_for_sales: false,
  })
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))
  return (
    <>
      <DialogHeader>
        <DialogTitle>Nuevo almacén</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(form, { onSuccess: close })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Clave</Label>
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.warehouse_type}
              onValueChange={(value) => set('warehouse_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General</SelectItem>
                <SelectItem value="KITCHEN">Cocina</SelectItem>
                <SelectItem value="BAR">Bar</SelectItem>
                <SelectItem value="HOUSEKEEPING">Ama de llaves</SelectItem>
                <SelectItem value="MINIBAR">Frigobar</SelectItem>
                <SelectItem value="SHOP">Tienda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ubicación</Label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
        </div>
        <Check
          label="Usar por defecto para ventas"
          checked={form.is_default_for_sales}
          onChange={(value) => set('is_default_for_sales', value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Crear almacén
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  )
}
