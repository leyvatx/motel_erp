import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Minus, Plus, Receipt, ScanLine, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { useRoomGrid } from '@/features/frontdesk/hooks'
import { useSellableProducts, useWarehouses } from '@/features/inventory/hooks'
import type { Product } from '@/features/inventory/types'
import { salesApi } from '@/features/sales/api'
import { apiErrorMessage } from '@/lib/axios'
import { formatMoney, toNumber } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { playSuccessTone } from '@/lib/sound'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/api'

interface CartLine {
  product: Product
  quantity: number
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

const QUICK_CASH = [50, 100, 200, 500, 1000]

export function PosTerminal() {
  const queryClient = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')
  const [destination, setDestination] = useState<string>('counter')

  const { data: products, isLoading } = useSellableProducts()
  const { data: warehouses } = useWarehouses()
  const grid = useRoomGrid()

  const salesWarehouse = useMemo(
    () =>
      (warehouses?.results ?? []).find((warehouse) => warehouse.is_default_for_sales) ??
      (warehouses?.results ?? [])[0],
    [warehouses],
  )

  const occupied = useMemo(
    () => (grid.data?.results ?? []).filter((room) => room.current_stay !== null),
    [grid.data],
  )
  const target = occupied.find((room) => String(room.id) === destination)
  const targetStay = target?.current_stay ?? null
  const isRoomOrder = destination !== 'counter' && targetStay !== null

  const catalog = useMemo(() => products?.results ?? [], [products])
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

  const total = cart.reduce(
    (sum, line) => sum + toNumber(line.product.sale_price) * line.quantity,
    0,
  )
  const change = toNumber(tendered) - total

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const addToCart = (product: Product): void => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [...current, { product, quantity: 1 }]
    })
  }

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const term = search.trim().toLowerCase()
    const exact = catalog.find(
      (product) => product.barcode.toLowerCase() === term || product.sku.toLowerCase() === term,
    )
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined)

    if (target) {
      addToCart(target)
      setSearch('')
    }
  }

  const changeQuantity = (productId: number, delta: number): void => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    )
  }

  const resetCart = (): void => {
    setCart([])
    setTendered('')
    setSearch('')
    searchRef.current?.focus()
  }

  const chargeToRoom = useMutation({
    mutationFn: async () => {
      if (!salesWarehouse) throw new Error('No hay almacén de venta configurado.')
      if (!targetStay?.folio_id) throw new Error('La habitación no tiene cuenta abierta.')

      return salesApi.createOrder({
        folio_id: targetStay.folio_id,
        warehouse_id: salesWarehouse.id,
        order_type: 'ROOM_SERVICE',
        notes: `Pedido de la habitación ${target?.number ?? ''}`,
        items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity.toFixed(3),
        })),
      })
    },
    onSuccess: (order) => {
      resetCart()
      playSuccessTone()
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.frontdesk.grid })
      toast.success(
        `Cargado a la habitación ${target?.number}`,
        `Consumo ${order.code} por ${formatMoney(order.total)}. Se cobra al salir.`,
      )
    },
    onError: (error) => toast.error('No se pudo cargar el consumo', apiErrorMessage(error)),
  })

  const checkout = useMutation({
    mutationFn: async () => {
      if (!salesWarehouse) throw new Error('No hay almacén de venta configurado.')

      const folio = await salesApi.openCounter('Venta de mostrador')
      await salesApi.createOrder({
        folio_id: folio.id,
        warehouse_id: salesWarehouse.id,
        order_type: 'COUNTER',
        items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity.toFixed(3),
        })),
      })
      await salesApi.payment(folio.id, {
        method,
        amount: total.toFixed(2),
        ...(method === 'CASH' && tendered ? { tendered_amount: tendered } : {}),
      })
      return salesApi.close(folio.id)
    },
    onSuccess: (folio) => {
      resetCart()
      playSuccessTone()
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.finances.currentShift })
      toast.success(`Venta ${folio.code} cerrada`, 'Ticket enviado a la impresora.')
    },
    onError: (error) => toast.error('No se pudo completar la venta', apiErrorMessage(error)),
  })

  const canCharge =
    cart.length > 0 && (method !== 'CASH' || toNumber(tendered) >= total) && !checkout.isPending

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_23rem]">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor="pos-destination" className="text-xs">
              ¿A dónde va este consumo?
            </Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger id="pos-destination" className="h-10 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="counter">Venta de mostrador (se cobra ahora)</SelectItem>
                {occupied.map((room) => (
                  <SelectItem key={room.id} value={String(room.id)}>
                    Habitación {room.number}
                    {room.current_stay?.vehicle_plate
                      ? ` · ${room.current_stay.vehicle_plate}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isRoomOrder && targetStay ? (
              <p className="text-2xs text-muted-foreground">
                Se carga a la cuenta {targetStay.code} y se cobra al hacer el check-out. Cuenta
                actual: {formatMoney(targetStay.folio_total)}.
              </p>
            ) : (
              <p className="text-2xs text-muted-foreground">
                {occupied.length === 0
                  ? 'No hay habitaciones ocupadas en este momento.'
                  : 'El cliente paga en el mostrador y se cierra el ticket de inmediato.'}
              </p>
            )}
          </div>

          <div className="relative">
            <ScanLine
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => {
                const inCart = cart.find((line) => line.product.id === product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
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
        </CardContent>
      </Card>

      <Card className="h-fit xl:sticky xl:top-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Cuenta</p>
            {cart.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setCart([])}>
                Vaciar
              </Button>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Escanea un producto o tócalo en el catálogo.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin">
              {cart.map((line) => (
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
                      onClick={() => changeQuantity(line.product.id, -1)}
                      aria-label="Quitar uno"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => changeQuantity(line.product.id, 1)}
                      aria-label="Agregar uno"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 text-destructive"
                      onClick={() => changeQuantity(line.product.id, -line.quantity)}
                      aria-label="Quitar renglón"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-3xl font-semibold tracking-tight tabular">
              {formatMoney(total)}
            </span>
          </div>

          {isRoomOrder ? (
            <>
              <div className="rounded-md border border-brand-accent/40 bg-brand-accent/5 px-3 py-2 text-xs">
                Se cargará a la habitación <strong>{target?.number}</strong> y quedará en su cuenta
                hasta el check-out.
              </div>
              <Button
                className="h-11 w-full text-base"
                disabled={cart.length === 0 || chargeToRoom.isPending}
                loading={chargeToRoom.isPending}
                onClick={() => chargeToRoom.mutate()}
              >
                <BedDouble />
                Cargar a la habitación {target?.number}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pos-method">Método de pago</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                  <SelectTrigger id="pos-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {method === 'CASH' ? (
                <div className="space-y-2">
                  <Label htmlFor="pos-tendered">Efectivo recibido</Label>
                  <Input
                    id="pos-tendered"
                    inputMode="decimal"
                    value={tendered}
                    onChange={(event) => setTendered(event.target.value)}
                    className="h-10 text-right text-lg tabular"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={total <= 0}
                      onClick={() => setTendered(total.toFixed(2))}
                    >
                      Exacto
                    </Button>
                    {QUICK_CASH.filter((amount) => amount >= total).map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setTendered(String(amount))}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>

                  {change > 0 ? (
                    <div className="flex items-baseline justify-between rounded-md bg-status-available/10 px-3 py-2">
                      <span className="text-sm text-muted-foreground">Cambio</span>
                      <span className="text-xl font-semibold tabular text-status-available">
                        {formatMoney(change)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                className="h-11 w-full text-base"
                disabled={!canCharge}
                loading={checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                <Receipt />
                Cobrar {total > 0 ? formatMoney(total) : ''}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
