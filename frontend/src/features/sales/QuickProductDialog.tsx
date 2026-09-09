import { useEffect, useState } from 'react'
import { PiPlus } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductImagePicker } from '@/features/inventory/components/ProductImagePicker'
import {
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useStockEntry,
} from '@/features/inventory/hooks'
import type { Product } from '@/features/inventory/types'
import { useSalesWarehouse } from '@/features/sales/hooks'
import { apiErrorMessage, apiFieldErrors } from '@/lib/axios'

/** Los tres cajones con los que arranca cualquier negocio de hospedaje.
 *  No son una taxonomía: son un atajo para no dejar a nadie atorado. */
const SUGERIDAS = [
  { name: 'Bebidas', kind: 'BEVERAGE' },
  { name: 'Botanas', kind: 'FOOD' },
  { name: 'Amenidades', kind: 'AMENITY' },
] as const

const UNIDADES = [
  { value: 'PIECE', label: 'Pieza' },
  { value: 'PACK', label: 'Paquete' },
  { value: 'BOX', label: 'Caja' },
  { value: 'LITER', label: 'Litro' },
  { value: 'KILOGRAM', label: 'Kilogramo' },
  { value: 'SERVICE', label: 'Servicio' },
] as const

/** SKU a partir del nombre.
 *
 *  El catálogo exige uno y es único por sucursal, pero a quien está cobrando
 *  con alguien enfrente no se le puede pedir que invente un código. Sale del
 *  nombre para que siga siendo legible en el Kardex, con un sufijo corto que
 *  evita el choque con un producto parecido. Quien quiera el suyo lo cambia
 *  después desde Inventarios, en Catálogos. */
function skuDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-)|(-$)/g, '')
    .slice(0, 20)

  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base || 'PROD'}-${sufijo}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre tecleado en el buscador cuando no hubo coincidencias. */
  nombreInicial?: string
  /** Se llama con el producto recién creado para meterlo a la venta. */
  onCreated: (product: Product) => void
}

/**
 * Alta de producto sin salir de la venta.
 *
 * Lo mínimo para poder cobrarlo: nombre, precio, categoría y unidad. Todo lo
 * demás -- código de barras, mínimos, impuesto, caducidad -- se completa luego
 * en Inventarios; exigirlo aquí deja al cliente esperando mientras el cajero
 * llena un formulario de catálogo.
 *
 * La acción principal no es "Guardar": es *guardar y agregar*, porque nadie da
 * de alta un producto en la caja por gusto, sino porque lo va a cobrar ahora.
 */
export function QuickProductDialog({ open, onOpenChange, nombreInicial = '', onCreated }: Props) {
  const { t } = useTranslation()
  const categories = useCategories()
  const create = useCreateProduct()
  const crearCategoria = useCreateCategory()
  const entrada = useStockEntry()
  const almacen = useSalesWarehouse()

  const [nombre, setNombre] = useState(nombreInicial)
  const [precio, setPrecio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [unidad, setUnidad] = useState<string>('PIECE')
  const [inventariable, setInventariable] = useState(true)
  const [existencias, setExistencias] = useState('')
  const [foto, setFoto] = useState<File | null>(null)

  /* El nombre que se tecleó en el buscador. El botón dice Crear "Agua mineral"
     y el formulario abría en blanco: había que volver a escribirlo con el
     cliente enfrente. `useState(nombreInicial)` solo mira su valor del primer
     render, y este diálogo se monta una vez y se reutiliza en cada alta. */
  useEffect(() => {
    if (open) setNombre(nombreInicial)
  }, [open, nombreInicial])

  const listaCategorias = categories.data?.results ?? []
  const categoriaElegida = categoria || (listaCategorias[0] ? String(listaCategorias[0].id) : '')
  const valido = nombre.trim().length >= 2 && Number(precio) > 0 && categoriaElegida !== ''
  const errores = apiFieldErrors(create.error)

  const guardar = (): void => {
    create.mutate(
      {
        payload: {
          sku: skuDesdeNombre(nombre),
          barcode: '',
          name: nombre.trim(),
          category: Number(categoriaElegida),
          unit: unidad,
          sale_price: Number(precio).toFixed(2),
          tax_rate: '0.00',
          default_min_stock: '0',
          is_sellable: true,
          is_stockable: inventariable,
          track_expiration: false,
        },
        image: foto,
      },
      {
        onSuccess: async (creado) => {
          const producto = creado as Product

          // Un producto inventariable nace en cero, y la venta descuenta de
          // existencias: sin esta entrada el cajero acababa de darlo de alta,
          // lo veía en la cuenta y al cobrar le salía "no hay suficiente". Se
          // registra lo que hay ahora en el almacén de venta, que es de donde
          // se va a descontar en un momento.
          if (inventariable && Number(existencias) > 0 && almacen) {
            await entrada
              .mutateAsync({
                product_id: producto.id,
                warehouse_id: almacen.id,
                quantity: String(Number(existencias)),
                movement_type: 'INITIAL',
                reason: t('venta.altaDesdePuntoDeVenta'),
              })
              .catch(() => undefined)
          }

          onCreated(producto)
          setNombre('')
          setPrecio('')
          setInventariable(true)
          setExistencias('')
          setFoto(null)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('venta.nuevoProducto')}
      description={t('venta.nuevoProductoDetalle')}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('venta.cancelar')}
          </Button>
          <Button disabled={!valido} loading={create.isPending} onClick={guardar}>
            {t('venta.guardarYAgregar')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nuevo-nombre">{t('venta.queEs')}</Label>
          <Input
            id="nuevo-nombre"
            autoFocus
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder={t('venta.ejemploProducto')}
            className="h-11"
          />
          {errores.name ? <p className="text-xs text-destructive">{errores.name}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="nuevo-precio">{t('venta.enCuantoSeVende')}</Label>
            <Input
              id="nuevo-precio"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={precio}
              onChange={(event) => setPrecio(event.target.value)}
              placeholder="0.00"
              className="h-11 text-right tabular"
            />
            {errores.sale_price ? (
              <p className="text-xs text-destructive">{errores.sale_price}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nuevo-unidad">{t('venta.comoSeVende')}</Label>
            <Select value={unidad} onValueChange={setUnidad}>
              <SelectTrigger id="nuevo-unidad" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nuevo-categoria">{t('venta.dondeVa')}</Label>
          <Select value={categoriaElegida} onValueChange={setCategoria}>
            <SelectTrigger id="nuevo-categoria" className="h-11">
              <SelectValue placeholder={t('venta.eligeCategoria')} />
            </SelectTrigger>
            <SelectContent>
              {listaCategorias.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.kind_display} · {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Un negocio recién dado de alta no tiene categorías, y sin una el
              formulario no se puede guardar: el cajero llegaba aquí con el
              cliente enfrente, encontraba el botón apagado y un letrero que lo
              mandaba a otra pantalla. Se crea desde aquí, en un toque, con el
              nombre del cajón donde de verdad va el producto. */}
          {listaCategorias.length === 0 ? (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('venta.sinCategorias')}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGERIDAS.map((sugerida) => (
                  <Button
                    key={sugerida.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={crearCategoria.isPending}
                    onClick={() =>
                      crearCategoria.mutate(
                        {
                          name: sugerida.name,
                          kind: sugerida.kind,
                          description: '',
                          sort_order: 0,
                        },
                        {
                          onSuccess: (creada) =>
                            setCategoria(String((creada as { id: number }).id)),
                        },
                      )
                    }
                  >
                    <PiPlus className="h-3.5 w-3.5" />
                    {sugerida.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Al final y opcional: quien está cobrando con alguien enfrente
            escribe nombre y precio y ya puede guardar. La foto se agrega ahora
            si hay tiempo, o después desde Inventarios. */}
        <div className="space-y-2">
          <Label>{t('venta.imagenOpcional')}</Label>
          <ProductImagePicker
            categoria={
              listaCategorias.find((item) => String(item.id) === categoriaElegida)?.name ?? ''
            }
            onChange={setFoto}
          />
        </div>

        <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={inventariable}
            onChange={(event) => setInventariable(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            {t('venta.descuentaExistencias')}
            <span className="block text-xs text-muted-foreground">
              {t('venta.descuentaDetalle')}
            </span>
          </span>
        </label>

        {/* Lo que hay ahora, contado a ojo desde el mostrador. Sin esto el
            producto nace en cero y la primera venta rebota por falta de
            existencia -- justo la venta que se estaba cobrando. */}
        {inventariable ? (
          <div className="space-y-2">
            <Label htmlFor="nuevo-existencias">{t('venta.cuantasTienes')}</Label>
            <Input
              id="nuevo-existencias"
              inputMode="numeric"
              type="number"
              min="0"
              step="1"
              value={existencias}
              onChange={(event) => setExistencias(event.target.value)}
              placeholder="0"
              className="h-11 text-right tabular"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {Number(existencias) > 0
                ? `Entran al ${almacen?.name ?? t('venta.almacenDeVenta')}. Puedes ajustarlas luego en Inventarios.`
                : t('venta.siLoDejasEnCero')}
            </p>
          </div>
        ) : null}

        {/* El motivo real, no una suposición. Decía siempre "revisa que el
            nombre no exista" y eso escondía lo que de verdad pasaba -- por
            ejemplo que el rol no tiene permiso de catálogo -- dejando al cajero
            corrigiendo un nombre que estaba bien. */}
        {create.isError && Object.keys(errores).length === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {apiErrorMessage(create.error, t('venta.noSePudoGuardarProducto'))}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
