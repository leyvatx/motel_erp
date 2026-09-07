import { useMemo, useRef, useState } from 'react'
import {
  PiBarcode,
  PiBeerBottle,
  PiCookie,
  PiMinus,
  PiPackage,
  PiPlus,
  PiSparkle,
  PiTrash,
} from 'react-icons/pi'
import type { IconType } from 'react-icons'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { QuickProductDialog } from '@/features/sales/QuickProductDialog'
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

/** Ícono por familia de producto.
 *
 *  El catálogo no guarda fotografías -- añadirlas exige un campo de imagen en
 *  el backend, y eso no se resuelve desde aquí -- así que la tarjeta se apoya
 *  en la categoría para no ser un rectángulo de texto más. Da lo que una foto
 *  daría en la práctica: reconocer el producto sin leerlo. */
const ICONO_POR_FAMILIA: { patron: RegExp; icono: IconType }[] = [
  { patron: /bebida|refresc|cerveza|agua|licor|vino/i, icono: PiBeerBottle },
  { patron: /botana|snack|dulce|comida|alimento/i, icono: PiCookie },
  { patron: /amenidad|limpieza|higiene|servicio/i, icono: PiSparkle },
]

function iconoDe(product: Product): IconType {
  return (
    ICONO_POR_FAMILIA.find(({ patron }) => patron.test(product.category_name))?.icono ?? PiPackage
  )
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
  gridClassName = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
  listClassName,
  allowCreate = false,
}: PickerProps) {
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
    { valor: TODOS, etiqueta: 'Todo' },
    ...(hayRecientes ? [{ valor: RECIENTES, etiqueta: 'Frecuentes' }] : []),
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
            placeholder="Escanea o escribe nombre, SKU o código..."
            className="h-11 pl-9 text-base"
            aria-label="Buscar producto"
          />
        </div>

        {allowCreate ? (
          <Button
            variant="outline"
            className="h-11 shrink-0 px-3"
            onClick={() => setCreando(true)}
            title="Dar de alta un producto sin salir de la venta"
          >
            <PiPlus />
            <span className="hidden sm:inline">Nuevo producto</span>
          </Button>
        ) : null}
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
          title={search ? `No hay ningún "${search.trim()}"` : 'Esta categoría está vacía'}
          description={
            search
              ? 'Revisa cómo se escribe, o dalo de alta ahora mismo y agrégalo a la venta.'
              : 'Los productos vendibles se dan de alta en Inventarios.'
          }
          icon={<PiPackage className="h-8 w-8" aria-hidden />}
          action={
            allowCreate && search ? (
              <Button onClick={() => setCreando(true)}>
                <PiPlus />
                Crear &quot;{search.trim()}&quot;
              </Button>
            ) : null
          }
        />
      ) : (
        <div
          className={cn('grid gap-2 overflow-y-auto scrollbar-thin', gridClassName, listClassName)}
        >
          {filtered.map((product) => {
            const inCart = cart.lines.find((line) => line.product.id === product.id)
            const Icono = iconoDe(product)
            const existencia = product.total_stock === null ? null : toNumber(product.total_stock)
            const agotado = product.is_stockable && existencia !== null && existencia <= 0

            return (
              <button
                key={product.id}
                type="button"
                disabled={agotado}
                onClick={() => agregar(product)}
                className={cn(
                  // 6.5 rem de alto: cabe el ícono, dos renglones de nombre y el
                  // precio sin que el dedo tenga que apuntar.
                  'relative flex min-h-[6.5rem] flex-col justify-between rounded-lg border bg-card p-3 text-left',
                  'transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md',
                  'active:translate-y-0 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  'disabled:pointer-events-none disabled:opacity-45',
                  inCart && 'border-brand-accent/50 ring-1 ring-brand-accent/20',
                )}
              >
                {inCart ? (
                  <Badge className="absolute right-2 top-2 h-5 min-w-5 justify-center px-1 tabular">
                    {inCart.quantity}
                  </Badge>
                ) : null}

                {/* El ícono va en su propio renglón, no al lado del nombre:
                    con cuatro columnas la tarjeta mide unos 150 px y quitarle
                    40 al texto deja "Agua embo...". El nombre completo es lo
                    que se lee de reojo; el ícono solo acompaña. */}
                <div>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-muted"
                    aria-hidden
                  >
                    <Icono className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
                    {product.name}
                  </p>
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="text-base font-semibold tabular">
                    {formatMoney(product.sale_price)}
                  </p>
                  {agotado ? (
                    <span className="text-2xs font-medium text-status-occupied">
                      Sin existencia
                    </span>
                  ) : existencia !== null && existencia <= 5 ? (
                    <span className="text-2xs text-status-cleaning tabular">
                      quedan {existencia}
                    </span>
                  ) : null}
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
  if (cart.lines.length === 0) {
    return (
      <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">
        La cuenta está vacía.
        <span className="mt-1 block text-xs">Escanea un producto o tócalo en el catálogo.</span>
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
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 lg:h-7 lg:w-7"
              onClick={() => cart.changeQuantity(line.product.id, -1)}
              aria-label={`Quitar uno de ${line.product.name}`}
            >
              <PiMinus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 lg:h-7 lg:w-7"
              onClick={() => cart.changeQuantity(line.product.id, 1)}
              aria-label={`Agregar uno de ${line.product.name}`}
            >
              <PiPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 text-destructive lg:h-7 lg:w-7"
              onClick={() => cart.changeQuantity(line.product.id, -line.quantity)}
              aria-label={`Quitar ${line.product.name} de la cuenta`}
            >
              <PiTrash className="h-3 w-3" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
