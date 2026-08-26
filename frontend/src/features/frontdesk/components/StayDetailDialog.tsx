import { useEffect, useState } from 'react'
import { PiBasket, PiBed, PiClock, PiCreditCard, PiPlus, PiProhibit } from 'react-icons/pi'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCancelStay,
  useCheckoutStay,
  useExtendStay,
  useStay,
  useTariffBlocks,
} from '@/features/frontdesk/hooks'
import { StayTimeline } from '@/features/audit/StayTimeline'
import { useSellableProducts } from '@/features/inventory/hooks'
import { CartLines, ProductPicker, useCart } from '@/features/sales/ProductCart'
import { useChargeToRoom, useFolio } from '@/features/sales/hooks'
import type { FolioCharge } from '@/features/sales/types'
import { useCountdown } from '@/hooks/useCountdown'
import { apiErrorMessage } from '@/lib/axios'
import { formatCountdown, formatDateTime, formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/api'

type Panel = 'detail' | 'extend' | 'checkout' | 'cancel' | 'charge'

interface Props {
  stayId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

export function StayDetailDialog({ stayId, open, onOpenChange }: Props) {
  const { data: stay, isLoading, isFetching, error, refetch } = useStay(open ? stayId : null)
  const [panel, setPanel] = useState<Panel>('detail')
  const folio = useFolio(open && stay?.folio_id ? stay.folio_id : null)

  useEffect(() => {
    if (open) setPanel('detail')
  }, [open, stayId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>Abriendo la renta</DialogTitle>
            </DialogHeader>
            <Skeleton className="h-32 w-full" />
          </>
        ) : !stay ? (
          /* Sin esta rama el esqueleto era también el estado de error: al
             fallar la consulta isLoading vuelve a false pero stay se queda en
             undefined, así que la condición seguía siendo cierta y el diálogo
             se quedaba cargando para siempre, sin decir qué pasó. */
          <>
            <DialogHeader>
              <DialogTitle>No se pudo abrir la renta</DialogTitle>
              <DialogDescription>
                {apiErrorMessage(error, 'La renta no se pudo cargar.')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button loading={isFetching} onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Habitación {stay.room_number}
                <Badge variant="occupied">{stay.status_display}</Badge>
              </DialogTitle>
              <DialogDescription>
                {stay.code} - {stay.room_type_name} / {stay.tariff_block_name}
              </DialogDescription>
            </DialogHeader>

            <StayTimer expiresAt={stay.expires_at} />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Entrada" value={formatDateTime(stay.check_in_at)} />
              <Field label="Vence" value={formatDateTime(stay.expires_at)} />
              <Field label="Ocupantes" value={String(stay.occupants)} />
              <Field label="Placas" value={stay.vehicle_plate || '-'} />
              <Field label="Huesped" value={stay.guest_name || '-'} />
              <Field label="Registro" value={stay.created_by_name ?? '-'} />
            </dl>

            <Separator />

            <FolioBreakdown
              charges={folio.data?.charges ?? []}
              isLoading={folio.isLoading}
              total={stay.folio_total}
              balance={stay.folio_balance}
            />

            {panel === 'detail' ? (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Rastro de esta renta
                </p>
                <div className="max-h-56 overflow-y-auto scrollbar-thin pr-1">
                  <StayTimeline stayId={stay.id} folioId={stay.folio_id} />
                </div>
              </div>
            ) : null}

            {panel === 'detail' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={() => setPanel('charge')}>
                  <PiBasket className="h-4 w-4" />
                  Consumo
                </Button>
                <Button variant="outline" onClick={() => setPanel('extend')}>
                  <PiPlus className="h-4 w-4" />
                  Extender
                </Button>
                <Button onClick={() => setPanel('checkout')}>
                  <PiCreditCard className="h-4 w-4" />
                  Cobrar
                </Button>
                <Button variant="destructive" onClick={() => setPanel('cancel')}>
                  <PiProhibit className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            ) : null}

            {panel === 'charge' ? (
              <ChargePanel
                folioId={stay.folio_id}
                roomNumber={stay.room_number}
                onDone={() => setPanel('detail')}
              />
            ) : null}

            {panel === 'extend' ? (
              <ExtendPanel
                stayId={stay.id}
                roomType={stay.room_type}
                onDone={() => setPanel('detail')}
              />
            ) : null}

            {panel === 'checkout' ? (
              <CheckoutPanel
                stayId={stay.id}
                balance={stay.folio_balance}
                onDone={() => {
                  setPanel('detail')
                  onOpenChange(false)
                }}
                onCancel={() => setPanel('detail')}
              />
            ) : null}

            {panel === 'cancel' ? (
              <CancelPanel
                stayId={stay.id}
                onDone={() => {
                  setPanel('detail')
                  onOpenChange(false)
                }}
                onCancel={() => setPanel('detail')}
              />
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FolioBreakdown({
  charges,
  isLoading,
  total,
  balance,
}: {
  charges: FolioCharge[]
  isLoading: boolean
  total: string | null
  balance: string | null
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Cuenta</span>
        <div className="text-right">
          <p className="text-xl font-bold tabular">{formatMoney(total)}</p>
          <p className="text-xs text-muted-foreground">Por cobrar {formatMoney(balance)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : charges.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          Sin cargos registrados todavía.
        </p>
      ) : (
        <ul className="max-h-44 divide-y overflow-y-auto scrollbar-thin">
          {charges.map((charge) => (
            <li key={charge.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{charge.description}</p>
                <p className="text-2xs text-muted-foreground">
                  {charge.charge_type_display}
                  {toNumber(charge.quantity) !== 1
                    ? ` · ${charge.quantity} × ${formatMoney(charge.unit_price)}`
                    : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular">
                {formatMoney(charge.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChargePanel({
  folioId,
  roomNumber,
  onDone,
}: {
  folioId: number | null
  roomNumber: string
  onDone: () => void
}) {
  const { data: products, isLoading } = useSellableProducts()
  const cart = useCart()
  const charge = useChargeToRoom({ folioId, roomNumber })

  if (!folioId) {
    return (
      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">
          Esta renta no tiene una cuenta abierta, así que no se le puede cargar consumo.
        </p>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={onDone}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <ProductPicker
        catalog={products?.results ?? []}
        isLoading={isLoading}
        cart={cart}
        gridClassName="grid-cols-2 sm:grid-cols-3"
        listClassName="max-h-52"
      />

      <Separator />

      <CartLines cart={cart} className="max-h-40" />

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-semibold tracking-tight tabular">
          {formatMoney(cart.total)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Se carga a la cuenta de la habitación {roomNumber} y se cobra al hacer el check-out.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Volver
        </Button>
        <Button
          disabled={cart.lines.length === 0}
          loading={charge.isPending}
          onClick={() =>
            charge.mutate(cart.items, {
              onSuccess: () => {
                cart.clear()
                onDone()
              },
            })
          }
        >
          <PiBed className="h-4 w-4" />
          Cargar a la habitación {roomNumber}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function StayTimer({ expiresAt }: { expiresAt: string }) {
  const countdown = useCountdown(expiresAt)

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border py-4 font-mono text-3xl font-bold tabular',
        countdown.level === 'expired'
          ? 'border-status-occupied/40 bg-status-occupied/10 text-status-occupied'
          : countdown.level === 'warning'
            ? 'border-status-cleaning/40 bg-status-cleaning/10 text-status-cleaning'
            : 'border-status-available/40 bg-status-available/10 text-status-available',
      )}
    >
      <PiClock className="h-6 w-6" aria-hidden />
      {formatCountdown(countdown.seconds)}
    </div>
  )
}

function ExtendPanel({
  stayId,
  roomType,
  onDone,
}: {
  stayId: number
  roomType: number
  onDone: () => void
}) {
  const { data: blocks } = useTariffBlocks(roomType)
  const extend = useExtendStay(stayId)
  const [blockId, setBlockId] = useState<string>('')

  return (
    <div className="space-y-3 rounded-md border p-4">
      <Label htmlFor="extend-block">Bloque a agregar</Label>
      <Select value={blockId} onValueChange={setBlockId}>
        <SelectTrigger id="extend-block">
          <SelectValue placeholder="Elige el tiempo" />
        </SelectTrigger>
        <SelectContent>
          {(blocks?.results ?? []).map((block) => (
            <SelectItem key={block.id} value={String(block.id)}>
              {block.name} - {formatMoney(block.current_price)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Volver
        </Button>
        <Button
          disabled={!blockId}
          loading={extend.isPending}
          onClick={() => extend.mutate({ tariff_block_id: Number(blockId) }, { onSuccess: onDone })}
        >
          Extender
        </Button>
      </div>
    </div>
  )
}

function CheckoutPanel({
  stayId,
  balance,
  onDone,
  onCancel,
}: {
  stayId: number
  balance: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const checkout = useCheckoutStay(stayId)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [amount, setAmount] = useState<string>(balance ?? '0')
  const [tendered, setTendered] = useState<string>('')

  const change = toNumber(tendered) - toNumber(amount)

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="method">Método de pago</Label>
          <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
            <SelectTrigger id="method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Importe</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
      </div>

      {method === 'CASH' ? (
        <div className="space-y-2">
          <Label htmlFor="tendered">Efectivo recibido</Label>
          <Input
            id="tendered"
            inputMode="decimal"
            value={tendered}
            onChange={(event) => setTendered(event.target.value)}
          />
          {change > 0 ? (
            <p className="text-sm">
              Cambio: <span className="font-semibold tabular">{formatMoney(change)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        El servidor agrega el recargo por tiempo excedido si aplica, cierra la cuenta e imprime el
        ticket.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Volver
        </Button>
        <Button
          loading={checkout.isPending}
          onClick={() =>
            checkout.mutate(
              {
                apply_overstay: true,
                payments: [
                  {
                    method,
                    amount,
                    ...(method === 'CASH' && tendered ? { tendered_amount: tendered } : {}),
                  },
                ],
              },
              { onSuccess: onDone },
            )
          }
        >
          Cobrar y cerrar
        </Button>
      </div>
    </div>
  )
}

function CancelPanel({
  stayId,
  onDone,
  onCancel,
}: {
  stayId: number
  onDone: () => void
  onCancel: () => void
}) {
  const cancel = useCancelStay(stayId)
  const [reason, setReason] = useState('')

  return (
    <div className="space-y-3 rounded-md border border-status-occupied/40 p-4">
      <Label htmlFor="reason">Motivo de la cancelación</Label>
      <Input
        id="reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Se capturo el cuarto equivocado"
      />
      <p className="text-xs text-muted-foreground">
        La renta no se borra: queda cancelada en la bitácora con tu usuario y el motivo.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Volver
        </Button>
        <Button
          variant="destructive"
          disabled={reason.trim().length < 5}
          loading={cancel.isPending}
          onClick={() => cancel.mutate(reason, { onSuccess: onDone })}
        >
          Cancelar renta
        </Button>
      </div>
    </div>
  )
}
