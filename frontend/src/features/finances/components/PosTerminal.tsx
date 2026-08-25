import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PiBed, PiReceipt } from 'react-icons/pi'

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
import { useSellableProducts } from '@/features/inventory/hooks'
import { CartLines, ProductPicker, useCart } from '@/features/sales/ProductCart'
import { useChargeToRoom, useSalesWarehouse } from '@/features/sales/hooks'
import { toastApiError } from '@/features/finances/shiftGuard'
import { salesApi } from '@/features/sales/api'
import { formatMoney, toNumber } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import { playSuccessTone } from '@/lib/sound'
import type { PaymentMethod } from '@/types/api'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

const QUICK_CASH = [50, 100, 200, 500, 1000]

export function PosTerminal() {
  const queryClient = useQueryClient()
  const cart = useCart()
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')
  const [destination, setDestination] = useState<string>('counter')

  const { data: products, isLoading } = useSellableProducts()
  const salesWarehouse = useSalesWarehouse()
  const grid = useRoomGrid()

  const occupied = useMemo(
    () => (grid.data?.results ?? []).filter((room) => room.current_stay !== null),
    [grid.data],
  )
  const target = occupied.find((room) => String(room.id) === destination)
  const targetStay = target?.current_stay ?? null
  const isRoomOrder = destination !== 'counter' && targetStay !== null

  const change = toNumber(tendered) - cart.total

  const resetCart = (): void => {
    cart.clear()
    setTendered('')
  }

  const chargeToRoom = useChargeToRoom({
    folioId: targetStay?.folio_id ?? null,
    roomNumber: target?.number ?? '',
  })

  const checkout = useMutation({
    mutationFn: async () => {
      if (!salesWarehouse) throw new Error('No hay almacén de venta configurado.')

      const folio = await salesApi.openCounter('Venta de mostrador')
      await salesApi.createOrder({
        folio_id: folio.id,
        warehouse_id: salesWarehouse.id,
        order_type: 'COUNTER',
        items: cart.items,
      })
      await salesApi.payment(folio.id, {
        method,
        amount: cart.total.toFixed(2),
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
    onError: (error) => toastApiError('No se pudo completar la venta', error),
  })

  const canCharge =
    cart.lines.length > 0 &&
    (method !== 'CASH' || toNumber(tendered) >= cart.total) &&
    !checkout.isPending

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

          <ProductPicker catalog={products?.results ?? []} isLoading={isLoading} cart={cart} />
        </CardContent>
      </Card>

      <Card className="h-fit xl:sticky xl:top-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Cuenta</p>
            {cart.lines.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => cart.clear()}>
                Vaciar
              </Button>
            ) : null}
          </div>

          <CartLines cart={cart} className="max-h-64" />

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-3xl font-semibold tracking-tight tabular">
              {formatMoney(cart.total)}
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
                disabled={cart.lines.length === 0 || chargeToRoom.isPending}
                loading={chargeToRoom.isPending}
                onClick={() => chargeToRoom.mutate(cart.items, { onSuccess: resetCart })}
              >
                <PiBed />
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
                      disabled={cart.total <= 0}
                      onClick={() => setTendered(cart.total.toFixed(2))}
                    >
                      Exacto
                    </Button>
                    {QUICK_CASH.filter((amount) => amount >= cart.total).map((amount) => (
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
                <PiReceipt />
                Cobrar {cart.total > 0 ? formatMoney(cart.total) : ''}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
