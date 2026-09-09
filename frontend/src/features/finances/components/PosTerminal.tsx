import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PiBed, PiReceipt } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
import { canManageCatalog, useAuthStore } from '@/store/auth'
import { queryKeys } from '@/lib/queryClient'
import { playSuccessTone } from '@/lib/sound'
import type { PaymentMethod } from '@/types/api'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

const QUICK_CASH = [50, 100, 200, 500, 1000]

/** Identifica un intento de venta ante el servidor.
 *
 *  `crypto.randomUUID` no existe en contextos sin HTTPS ni en navegadores
 *  viejos, y una terminal de mostrador puede ser cualquiera de las dos cosas;
 *  el respaldo basta porque la clave solo tiene que ser única dentro de la
 *  sucursal y del rato que dura una venta. */
function nuevoIntento(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function PosTerminal() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const cart = useCart()
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')
  const [destination, setDestination] = useState<string>('counter')

  const intentoRef = useRef(nuevoIntento())

  // El alta rápida solo se ofrece a quien el servidor va a dejar guardar.
  // Ofrecerla a recepción llenaba el formulario para terminar en un 403 con el
  // cliente esperando.
  const puedeCrearProductos = useAuthStore((state) => canManageCatalog(state.user))

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
    // Carrito nuevo, intento nuevo. Mientras no se vacíe, todos los reintentos
    // comparten clave y el servidor los reconoce como el mismo cobro.
    intentoRef.current = nuevoIntento()
  }

  const chargeToRoom = useChargeToRoom({
    folioId: targetStay?.folio_id ?? null,
    stayId: targetStay?.id ?? null,
    roomNumber: target?.number ?? '',
  })

  const checkout = useMutation({
    mutationFn: () => {
      if (!salesWarehouse) throw new Error(t('caja.sinAlmacenDeVenta'))

      return salesApi.counterSale({
        warehouse_id: salesWarehouse.id,
        items: cart.items,
        method,
        notes: t('caja.ventaDeMostradorCorto'),
        attempt_key: intentoRef.current,
        ...(method === 'CASH' && tendered ? { tendered_amount: tendered } : {}),
      })
    },
    onSuccess: (folio) => {
      resetCart()
      playSuccessTone()
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.finances.currentShift })
      toast.success(`Venta ${folio.code} cobrada`, `Total ${formatMoney(folio.total)}.`)
    },
    onError: (error) => toastApiError(t('caja.noSePudoCompletarVenta'), error),
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
              {t('caja.aDondeVa')}
            </Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger id="pos-destination" className="h-10 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="counter">{t('caja.ventaDeMostrador')}</SelectItem>
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
                  ? t('caja.sinHabitacionesOcupadas')
                  : t('caja.clientePagaEnMostrador')}
              </p>
            )}
          </div>

          <ProductPicker
            catalog={products?.results ?? []}
            isLoading={isLoading}
            cart={cart}
            allowCreate={puedeCrearProductos}
          />
        </CardContent>
      </Card>

      <Card className="h-fit xl:sticky xl:top-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('caja.cuenta')}</p>
            {cart.lines.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => cart.clear()}>
                {t('caja.vaciar')}
              </Button>
            ) : null}
          </div>

          <CartLines cart={cart} className="max-h-64" />

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t('caja.total')}</span>
            <span className="text-3xl font-semibold tracking-tight tabular">
              {formatMoney(cart.total)}
            </span>
          </div>

          {isRoomOrder ? (
            <>
              <div className="rounded-md border border-brand-accent/40 bg-brand-accent/5 px-3 py-2 text-xs">
                {t('caja.seCargaraALaHabitacion')} <strong>{target?.number}</strong> y quedará en su
                cuenta hasta el check-out.
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
                <Label htmlFor="pos-method">{t('caja.metodoDePago')}</Label>
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
                  <Label htmlFor="pos-tendered">{t('caja.efectivoRecibido')}</Label>
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
                      {t('caja.exacto')}
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
                      <span className="text-sm text-muted-foreground">{t('caja.cambio')}</span>
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

              {/* Un botón apagado sin motivo es el que hace que alguien lo
                  golpee tres veces con el cliente enfrente. El importe recibido
                  es obligatorio para calcular el cambio, así que se dice, y se
                  dice cuánto falta. */}
              {!canCharge && !checkout.isPending ? (
                <p className="text-center text-xs text-muted-foreground">
                  {cart.lines.length === 0
                    ? t('caja.agregaAlMenosUnProducto')
                    : `Anota cuánto pagó el cliente: faltan ${formatMoney(cart.total - toNumber(tendered))}.`}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
