import { useEffect, useState } from 'react'
import { PiClock, PiCreditCard, PiPlus, PiProhibit } from 'react-icons/pi'

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
import { useCountdown } from '@/hooks/useCountdown'
import { formatCountdown, formatDateTime, formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/api'

type Panel = 'detail' | 'extend' | 'checkout' | 'cancel'

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
  const { data: stay, isLoading } = useStay(open ? stayId : null)
  const [panel, setPanel] = useState<Panel>('detail')

  useEffect(() => {
    if (open) setPanel('detail')
  }, [open, stayId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {isLoading || !stay ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 w-full" />
          </div>
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

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cuenta</span>
              <div className="text-right">
                <p className="text-xl font-bold tabular">{formatMoney(stay.folio_total)}</p>
                <p className="text-xs text-muted-foreground">
                  Por cobrar {formatMoney(stay.folio_balance)}
                </p>
              </div>
            </div>

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

            {stay.extensions.length > 0 ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Extensiones</p>
                <ul className="space-y-1 text-xs">
                  {stay.extensions.map((extension) => (
                    <li key={extension.id} className="flex justify-between">
                      <span>+{extension.minutes} min</span>
                      <span className="tabular">{formatMoney(extension.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {panel === 'detail' ? (
              <div className="grid grid-cols-3 gap-2">
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
