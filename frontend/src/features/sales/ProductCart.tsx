import { useMemo, useRef, useState } from 'react'
import { PiMinus, PiPlus, PiScan, PiTrash } from 'react-icons/pi'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    total: lines.reduce(
      (sum, line) => sum + toNumber(line.product.sale_price) * line.quantity,
      0,
    ),
    items: lines.map((line) => ({
      product_id: line.product.id,
      quantity: line.quantity.toFixed(3),
    })),
  }
}

interface PickerProps {
  catalog: Product[]
  isLoading: boolean
  cart: Cart
  autoFocus?: boolean
  gridClassName?: string
  listClassName?: string
}

export function ProductPicker({
  catalog,
  isLoading,
  cart,
  autoFocus = true,
  gridClassName = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
  listClassName,
}: PickerProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return catalog
    return catalog.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.toLowerCase().includes(term),
    )
  }, [catalog, search])

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const term = search.trim().toLowerCase()
    const exact = catalog.find(
      (product) => product.barcode.toLowerCase() === term || product.sku.toLowerCase() === term,
    )
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined)

    if (target) {
      cart.add(target)
      setSearch('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <PiScan
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

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Cargando catálogo...</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ningún producto coincide con la búsqueda.
        </p>
      ) : (
        <div className={cn('grid gap-2 overflow-y-auto scrollbar-thin', gridClassName, listClassName)}>
          {filtered.map((product) => {
            const inCart = cart.lines.find((line) => line.product.id === product.id)
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => cart.add(product)}
                className={cn(
                  'relative flex flex-col justify-between rounded-lg border bg-card p-3 text-left',
                  'transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md',
                  'active:translate-y-0 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  inCart && 'border-brand-accent/50 ring-1 ring-brand-accent/20',
                )}
              >
                {inCart ? (
                  <Badge className="absolute right-2 top-2 h-5 min-w-5 justify-center px-1 tabular">
                    {inCart.quantity}
                  </Badge>
                ) : null}
                <p className="line-clamp-2 pr-6 text-sm font-medium">{product.name}</p>
                <p className="mt-2 text-base font-semibold tabular">
                  {formatMoney(product.sale_price)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CartLines({ cart, className }: { cart: Cart; className?: string }) {
  if (cart.lines.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Escanea un producto o tócalo en el catálogo.
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
              className="h-7 w-7"
              onClick={() => cart.changeQuantity(line.product.id, -1)}
              aria-label="Quitar uno"
            >
              <PiMinus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => cart.changeQuantity(line.product.id, 1)}
              aria-label="Agregar uno"
            >
              <PiPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-destructive"
              onClick={() => cart.changeQuantity(line.product.id, -line.quantity)}
              aria-label="Quitar renglón"
            >
              <PiTrash className="h-3 w-3" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
