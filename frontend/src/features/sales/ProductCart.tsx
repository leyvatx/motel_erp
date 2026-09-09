import { useMemo, useRef, useState } from 'react'
import { PiBarcode, PiMinus, PiPackage, PiPlus, PiTrash } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { QuickProductDialog } from '@/features/sales/QuickProductDialog'
import { ProductThumb } from '@/features/inventory/productIcon'
import type { Product } from '@/features/inventory/types'
import { formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface CartLine {
  product: Product
  quantity: number
}

export interface Cart {
  lines: CartLine[]
  add: (product: Product) => void
  changeQuantity: (productId: number, delta: number) => void
  clear: () => void
  total: number
  items: { product_id: number; quantity: string }[]
}

export function useCart(): Cart {
  const [lines, setLines] = useState<CartLine[]>([])

  const add = (product: Product): void =>
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [...current, { product, quantity: 1 }]
    })

  const changeQuantity = (productId: number, delta: number): void =>
    setLines((current) =>
      current
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    )

  return {
    lines,
    add,
    changeQuantity,
    clear: () => setLines([]),
    total: lines.reduce((sum, line) => sum + toNumber(line.product.sale_price) * line.quantity, 0),
    items: lines.map((line) => ({
      product_id: line.product.id,
      quantity: line.quantity.toFixed(3),
    })),
  }
}

/** Los últimos productos que se vendieron *en esta terminal*.
 *
 *  No es analítica del negocio -- eso no existe todavía en la API y no se
 *  inventa aquí -- sino memoria del mostrador: en una caja el 80 % de los
 *  tickets son los mismos seis productos, y tenerlos de primeros ahorra la
 *  búsqueda que se repite todo el turno. Vive en el navegador porque es una
 *  propiedad del puesto de trabajo, no de la cuenta.
 */
const CLAVE_RECIENTES = 'erp-pos-recientes'
const MAX_RECIENTES = 8

function leerRecientes(): number[] {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES)
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

function recordarReciente(productId: number): number[] {
  const lista = [productId, ...leerRecientes().filter((id) => id !== productId)].slice(
    0,
    MAX_RECIENTES,
  )
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista))
  } catch {
    // Almacenamiento bloqueado: se pierde el atajo, no la venta.
  }
  return lista
}

const TODOS = 'todos'
const RECIENTES = 'recientes'

interface PickerProps {
  catalog: Product[]
  isLoading: boolean
  cart: Cart
  autoFocus?: boolean
  gridClassName?: string
  listClassName?: string
  /** El alta rápida solo tiene sentido donde se está vendiendo. */
  allowCreate?: boolean
}

export function ProductPicker({
  catalog,
  isLoading,
  cart,
  autoFocus = true,
  gridClassName = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
  listClassName,
  allowCreate = false,
}: PickerProps) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<string>(TODOS)
  const [recientes, setRecientes] = useState<number[]>(leerRecientes)
  const [creando, setCreando] = useState(false)

  const agregar = (product: Product): void => {
    cart.add(product)
    setRecientes(recordarReciente(product.id))
  }

  const categorias = useMemo(
    () => [...new Set(catalog.map((product) => product.category_name).filter(Boolean))].sort(),
    [catalog],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    const porCategoria =
      categoria === TODOS
        ? catalog
        : categoria === RECIENTES
          ? recientes
              .map((id) => catalog.find((product) => product.id === id))
              .filter((product): product is Product => product !== undefined)
          : catalog.filter((product) => product.category_name === categoria)

    if (!term) return porCategoria
    return porCategoria.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.toLowerCase().includes(term),
    )
  }, [catalog, search, categoria, recientes])

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const term = search.trim().toLowerCase()
    const exact = catalog.find(
      (product) => product.barcode.toLowerCase() === term || product.sku.toLowerCase() === term,
    )
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined)

    if (target) {
      agregar(target)
      setSearch('')
    }
  }

  const hayRecientes = recientes.some((id) => catalog.some((product) => product.id === id))

  const filtros = [
    { valor: TODOS, etiqueta: t('venta.todo') },
    ...(hayRecientes ? [{ valor: RECIENTES, etiqueta: t('venta.frecuentes') }] : []),
    ...categorias.map((nombre) => ({ valor: nombre, etiqueta: nombre })),
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <PiBarcode
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            autoFocus={autoFocus}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKey}
            placeholder={t('venta.buscarPlaceholder')}
            className="h-11 pl-9 text-base"
            aria-label={t('venta.buscarProducto')}
          />
        </div>

      </div>

      {/* Categorías como fichas deslizables: en una tableta de mostrador un
          desplegable exige dos toques y tapa el catálogo mientras está abierto. */}
      {filtros.length > 2 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none px-1 pb-0.5">
          {filtros.map((filtro) => (
            <button
              key={filtro.valor}
              type="button"
              onClick={() => setCategoria(filtro.valor)}
              aria-pressed={categoria === filtro.valor}
              className={cn(
                'h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium',
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                categoria === filtro.valor
                  ? 'border-transparent bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className={cn('grid gap-2', gridClassName)}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-[6.5rem] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            search
              ? t('venta.noHayNingun', { nombre: search.trim() })
              : t('venta.estaCategoriaVacia')
          }
          description={search ? t('venta.revisaComoSeEscribe') : t('venta.productosSeDanDeAlta')}
          icon={<PiPackage className="h-8 w-8" aria-hidden />}
          action={
            allowCreate && search ? (
              <Button onClick={() => setCreando(true)}>
                <PiPlus />
                {t('venta.crearNombre', { nombre: search.trim() })}
              </Button>
            ) : null
          }
        />
      ) : (
        <div
          className={cn('grid gap-4 overflow-y-auto scrollbar-thin', gridClassName, listClassName)}
        >
          {/* Dar de alta un producto sin salir de la venta, desde el mismo
              lugar donde se elige. Va primera y no al final: al final se
              esconde detrás del scroll justo cuando hace falta, que es cuando
              el producto que se busca no está. */}
          {allowCreate ? (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className={cn(
                'flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl p-3',
                'border-2 border-dashed border-border text-muted-foreground',
                'transition-[transform,border-color,color] duration-150',
                'hover:border-brand-accent/50 hover:text-foreground active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
              )}
            >
              <PiPlus className="h-6 w-6" aria-hidden />
              <span className="text-center text-xs font-medium leading-snug">
                {t('venta.anadirProducto')}
              </span>
            </button>
          ) : null}

          {filtered.map((product) => {
            const inCart = cart.lines.find((line) => line.product.id === product.id)
            // `total_stock` llega nulo cuando el producto no tiene ni un
            // renglón de existencias -- el caso de uno recién dado de alta. Para
            // vender eso es cero, no "desconocido": tratándolo como desconocido
            // la tarjeta se quedaba encendida, el producto entraba a la cuenta y
            // el cobro reventaba con el cliente enfrente.
            const existencia = product.is_stockable ? toNumber(product.total_stock ?? '0') : null
            const agotado = existencia !== null && existencia <= 0

            return (
              <button
                key={product.id}
                type="button"
                disabled={agotado}
                onClick={() => agregar(product)}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left',
                  'transition-[transform,box-shadow,border-color] duration-150',
                  'hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md',
                  'active:translate-y-0 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  // Agotado se ve agotado: apagado y sin color. Antes solo
                  // bajaba la opacidad y a media luz seguía pareciendo vendible.
                  'disabled:pointer-events-none disabled:opacity-50 disabled:grayscale',
                  inCart && 'border-brand-accent/50 ring-1 ring-brand-accent/20',
                )}
              >
                {/* La foto manda, y ocupa el ancho entero de la tarjeta.
                    Antes era un ícono de 28 px arriba del nombre: para elegir
                    había que leer, y leer con el cliente enfrente es lento.
                    Con la imagen a este tamaño el producto se reconoce de un
                    vistazo, que es de lo que trata un catálogo visual. */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  <ProductThumb
                    src={product.image_url}
                    categoria={product.category_name}
                    className="h-full w-full"
                    iconClassName="h-8 w-8 text-muted-foreground/60"
                  />

                  {/* Micro-insignia de existencia, flotando sobre la foto: en
                      la esquina no le quita renglón al nombre ni al precio, y
                      es lo que se mira antes de tocar. */}
                  {existencia !== null ? (
                    <span
                      className={cn(
                        'absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-2xs font-medium tabular',
                        'backdrop-blur-[2px]',
                        agotado
                          ? 'bg-status-occupied/90 text-white'
                          : existencia <= 5
                            ? 'bg-status-cleaning/90 text-white'
                            : 'bg-background/85 text-muted-foreground',
                      )}
                    >
                      {agotado ? t('venta.sinExistencia') : existencia}
                    </span>
                  ) : null}

                  {inCart ? (
                    <Badge className="absolute right-1.5 top-1.5 h-5 min-w-5 justify-center px-1 tabular">
                      {inCart.quantity}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col justify-between gap-1 p-2.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                  {/* Monoespaciada: en una columna de precios, las cifras se
                      comparan por su posición y no hay que leerlas una a una. */}
                  <p className="font-mono text-base font-semibold leading-none tabular">
                    {formatMoney(product.sale_price)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {allowCreate ? (
        <QuickProductDialog
          open={creando}
          onOpenChange={setCreando}
          nombreInicial={search.trim()}
          onCreated={(product) => {
            agregar(product)
            setSearch('')
          }}
        />
      ) : null}
    </div>
  )
}

export function CartLines({ cart, className }: { cart: Cart; className?: string }) {
  const { t } = useTranslation()
  if (cart.lines.length === 0) {
    return (
      <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">
        {t('venta.cuentaVacia')}
        <span className="mt-1 block text-xs">{t('venta.escaneaOToca')}</span>
      </p>
    )
  }

  return (
    <ul className={cn('space-y-1 overflow-y-auto scrollbar-thin', className)}>
      {cart.lines.map((line) => (
        <li
          key={line.product.id}
          className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-accent/50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{line.product.name}</p>
            <p className="text-2xs text-muted-foreground tabular">
              {line.quantity} × {formatMoney(line.product.sale_price)}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium tabular">
            {formatMoney(toNumber(line.product.sale_price) * line.quantity)}
          </span>
          <div className="flex shrink-0 items-center">
            {/* 44x44 en el teléfono, que es el mínimo con el que un pulgar
                acierta. Estos tres botones están pegados y se tocan con el
                cliente enfrente: 36 px dejaba que restar cayera en sumar. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-11 w-11 lg:h-8 lg:w-8"
              onClick={() => cart.changeQuantity(line.product.id, -1)}
              aria-label={t('venta.quitarUnoDe', { producto: line.product.name })}
            >
              <PiMinus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-11 w-11 lg:h-8 lg:w-8"
              onClick={() => cart.changeQuantity(line.product.id, 1)}
              aria-label={t('venta.agregarUnoDe', { producto: line.product.name })}
            >
              <PiPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-11 w-11 text-destructive lg:h-8 lg:w-8"
              onClick={() => cart.changeQuantity(line.product.id, -line.quantity)}
              aria-label={t('venta.quitarDeLaCuenta', { producto: line.product.name })}
            >
              <PiTrash className="h-3.5 w-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
