import { useState } from 'react'
import { PiCube, PiFolderPlus, PiPackage, PiPlus } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
import { ProductImagePicker } from '@/features/inventory/components/ProductImagePicker'
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
  const { t } = useTranslation()
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
          placeholder={t('inventario.buscarProducto')}
          className="max-w-xs"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog('category')}>
            <PiFolderPlus /> {t('inventario.categoria')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('warehouse')}>
            <PiCube /> {t('inventario.almacen')}
          </Button>
          <Button size="sm" onClick={() => setDialog('product')}>
            <PiPackage /> {t('inventario.producto')}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventario.producto')}</TableHead>
                  <TableHead>{t('inventario.categoria')}</TableHead>
                  <TableHead className="text-right">{t('inventario.existencia')}</TableHead>
                  <TableHead className="text-right">{t('inventario.venta')}</TableHead>
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
                          <Badge variant="secondary">{t('inventario.servicio')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(product.sale_price)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={4} message={t('inventario.sinProductos')} />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">{t('inventario.almacenes')}</h3>
              <p className="text-xs text-muted-foreground">{t('inventario.puntosFisicos')}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventario.clave')}</TableHead>
                  <TableHead>{t('inventario.nombre')}</TableHead>
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
  const { t } = useTranslation()
  const categories = useCategories()
  const create = useCreateProduct()
  const [foto, setFoto] = useState<File | null>(null)
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
        <DialogTitle>{t('inventario.nuevoProductoOServicio')}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(
            { payload: { ...form, category: Number(form.category) }, image: foto },
            { onSuccess: close },
          )
        }}
      >
        <div className="space-y-2">
          <Label>{t('inventario.imagen')}</Label>
          <ProductImagePicker
            categoria={
              categories.data?.results.find((item) => String(item.id) === form.category)?.name ?? ''
            }
            onChange={setFoto}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('inventario.sku')}</Label>
            <Input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.nombre')}</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.categoria')}</Label>
            <Select value={form.category} onValueChange={(value) => set('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('inventario.selecciona')} />
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
            <Label>{t('inventario.unidad')}</Label>
            <Select value={form.unit} onValueChange={(value) => set('unit', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIECE">{t('inventario.pieza')}</SelectItem>
                <SelectItem value="PACK">{t('inventario.paquete')}</SelectItem>
                <SelectItem value="BOX">{t('inventario.cajaUnidad')}</SelectItem>
                <SelectItem value="LITER">{t('inventario.litro')}</SelectItem>
                <SelectItem value="KILOGRAM">{t('inventario.kilogramo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.precioDeVenta')}</Label>
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
            <Label>{t('inventario.stockMinimoSugerido')}</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.default_min_stock}
              onChange={(e) => set('default_min_stock', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.codigoDeBarras')}</Label>
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.impuestoDetalle')}</Label>
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
            label={t('inventario.controlaExistencias')}
            checked={form.is_stockable}
            onChange={(value) => set('is_stockable', value)}
          />
          <Check
            label={t('inventario.sePuedeVender')}
            checked={form.is_sellable}
            onChange={(value) => set('is_sellable', value)}
          />
          <Check
            label={t('inventario.controlaCaducidad')}
            checked={form.track_expiration}
            onChange={(value) => set('track_expiration', value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('inventario.cancelar')}
          </Button>
          <Button type="submit" disabled={create.isPending || !form.category}>
            <PiPlus /> {t('inventario.crearProducto')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function CategoryForm({ close }: { close: () => void }) {
  const { t } = useTranslation()
  const create = useCreateCategory()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('OTHER')
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('inventario.nuevaCategoria')}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ name, kind, description: '', sort_order: 0 }, { onSuccess: close })
        }}
      >
        <div className="space-y-2">
          <Label>{t('inventario.nombre')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{t('inventario.familia')}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOOD">{t('inventario.alimentos')}</SelectItem>
              <SelectItem value="BEVERAGE">{t('inventario.bebidas')}</SelectItem>
              <SelectItem value="CLEANING">Limpieza</SelectItem>
              <SelectItem value="LINEN">{t('inventario.blancos')}</SelectItem>
              <SelectItem value="AMENITY">{t('inventario.amenidades')}</SelectItem>
              <SelectItem value="SHOP">{t('inventario.tienda')}</SelectItem>
              <SelectItem value="OTHER">{t('inventario.otros')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('inventario.cancelar')}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {t('inventario.crearCategoria')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function WarehouseForm({ close }: { close: () => void }) {
  const { t } = useTranslation()
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
        <DialogTitle>{t('inventario.nuevoAlmacen')}</DialogTitle>
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
            <Label>{t('inventario.clave')}</Label>
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.nombre')}</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.tipo')}</Label>
            <Select
              value={form.warehouse_type}
              onValueChange={(value) => set('warehouse_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">{t('inventario.general')}</SelectItem>
                <SelectItem value="KITCHEN">{t('inventario.cocina')}</SelectItem>
                <SelectItem value="BAR">{t('inventario.bar')}</SelectItem>
                <SelectItem value="HOUSEKEEPING">{t('inventario.amaDeLlaves')}</SelectItem>
                <SelectItem value="MINIBAR">{t('inventario.frigobar')}</SelectItem>
                <SelectItem value="SHOP">{t('inventario.tienda')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('inventario.ubicacion')}</Label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
        </div>
        <Check
          label={t('inventario.usarPorDefectoVentas')}
          checked={form.is_default_for_sales}
          onChange={(value) => set('is_default_for_sales', value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('inventario.cancelar')}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {t('inventario.crearAlmacen')}
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
