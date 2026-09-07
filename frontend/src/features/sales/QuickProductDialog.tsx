import { useState } from 'react'

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
import { useCategories, useCreateProduct } from '@/features/inventory/hooks'
import type { Product } from '@/features/inventory/types'
import { apiFieldErrors } from '@/lib/axios'

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
  const categories = useCategories()
  const create = useCreateProduct()

  const [nombre, setNombre] = useState(nombreInicial)
  const [precio, setPrecio] = useState('')
  const [categoria, setCategoria] = useState('')
  const [unidad, setUnidad] = useState<string>('PIECE')
  const [inventariable, setInventariable] = useState(true)

  const listaCategorias = categories.data?.results ?? []
  const categoriaElegida = categoria || (listaCategorias[0] ? String(listaCategorias[0].id) : '')
  const valido = nombre.trim().length >= 2 && Number(precio) > 0 && categoriaElegida !== ''
  const errores = apiFieldErrors(create.error)

  const guardar = (): void => {
    create.mutate(
      {
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
      {
        onSuccess: (producto) => {
          onCreated(producto as Product)
          setNombre('')
          setPrecio('')
          setInventariable(true)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo producto"
      description="Lo mínimo para poder cobrarlo. El resto de la ficha se completa después en Inventarios."
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valido} loading={create.isPending} onClick={guardar}>
            Guardar y agregar a la venta
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nuevo-nombre">¿Qué es?</Label>
          <Input
            id="nuevo-nombre"
            autoFocus
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Agua embotellada 600 ml"
            className="h-11"
          />
          {errores.name ? <p className="text-xs text-destructive">{errores.name}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="nuevo-precio">¿En cuánto se vende?</Label>
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
            <Label htmlFor="nuevo-unidad">¿Cómo se vende?</Label>
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
          <Label htmlFor="nuevo-categoria">¿Dónde va?</Label>
          <Select value={categoriaElegida} onValueChange={setCategoria}>
            <SelectTrigger id="nuevo-categoria" className="h-11">
              <SelectValue placeholder="Elige una categoría" />
            </SelectTrigger>
            <SelectContent>
              {listaCategorias.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.kind_display} · {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {listaCategorias.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Todavía no hay categorías. Se crean en Inventarios, pestaña Catálogos.
            </p>
          ) : null}
        </div>

        <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={inventariable}
            onChange={(event) => setInventariable(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            Descuenta existencias al venderse
            <span className="block text-xs text-muted-foreground">
              Desmárcalo si es un servicio (lavandería, cargo extra) que no consume inventario.
            </span>
          </span>
        </label>

        {create.isError && Object.keys(errores).length === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            No se pudo guardar. Revisa que el nombre no exista ya en el catálogo.
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
