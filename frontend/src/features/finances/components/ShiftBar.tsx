import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PiArrowLineDown,
  PiArrowLineUp,
  PiCaretDown,
  PiLock,
  PiPrinter,
  PiReceipt,
} from 'react-icons/pi'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CashBreakdownInput,
  breakdownTotal,
} from '@/features/finances/components/CashBreakdownInput'
import { useCashMovement, useCloseShift, usePrintShiftReport } from '@/features/finances/hooks'
import type { CashBreakdown, Shift } from '@/features/finances/types'
import { formatMoney, formatTime, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  shift: Shift
  onRegisterExpense: () => void
}

export function ShiftBar({ shift, onRegisterExpense }: Props) {
  const { t } = useTranslation()
  const [closing, setClosing] = useState(false)
  const [movement, setMovement] = useState<'IN' | 'OUT' | null>(null)
  const printReport = usePrintShiftReport()

  const open = shift.status === 'OPEN'
  const difference = toNumber(shift.difference)

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              open ? 'bg-status-available' : 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
          <span className="text-sm font-medium">{open ? 'Turno abierto' : 'Turno cerrado'}</span>
          <Badge variant="secondary" className="font-mono">
            {shift.code}
          </Badge>
        </div>

        <span className="text-xs text-muted-foreground">
          {shift.cashier_name} · desde {formatTime(shift.opened_at)}
        </span>

        <span className="text-xs text-muted-foreground">
          Fondo {formatMoney(shift.opening_balance)}
        </span>

        {!open ? (
          <span
            className={cn(
              'text-xs font-medium tabular',
              difference === 0 ? 'text-status-available' : 'text-status-occupied',
            )}
          >
            {difference === 0
              ? 'Corte cuadrado'
              : `${difference < 0 ? 'Faltante' : 'Sobrante'} ${formatMoney(Math.abs(difference))}`}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {open ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t('caja.movimientosDeCaja')}
                  <PiCaretDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {t('caja.todoQuedaLigado')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRegisterExpense}>
                  <PiReceipt />
                  {t('caja.registrarUnGasto')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMovement('OUT')}>
                  <PiArrowLineUp />
                  {t('caja.retirarABoveda')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMovement('IN')}>
                  <PiArrowLineDown />
                  {t('caja.meterCambio')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              loading={printReport.isPending}
              onClick={() => printReport.mutate(shift.id)}
            >
              <PiPrinter />
              {t('caja.imprimirCorte')}
            </Button>
          )}

          {open ? (
            <Button size="sm" onClick={() => setClosing(true)}>
              <PiLock />
              {t('caja.cerrarTurno')}
            </Button>
          ) : null}
        </div>
      </div>

      {closing ? <CloseShiftDialog shift={shift} onClose={() => setClosing(false)} /> : null}
      {movement ? (
        <CashMovementDialog shift={shift} direction={movement} onClose={() => setMovement(null)} />
      ) : null}
    </>
  )
}

function CloseShiftDialog({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { t } = useTranslation()
  const closeShift = useCloseShift(shift.id)
  const [breakdown, setBreakdown] = useState<CashBreakdown>({})
  const total = breakdownTotal(breakdown)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cerrar turno {shift.code}</DialogTitle>
          <DialogDescription>
            Cuenta el efectivo del cajón y captúralo. El sistema calculará lo esperado hasta después
            de que declares, para que el conteo sea a ciegas.
          </DialogDescription>
        </DialogHeader>

        <CashBreakdownInput
          value={breakdown}
          onChange={setBreakdown}
          total={total}
          label={t('caja.efectivoDeclarado')}
        />

        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Si quedan gastos pendientes de aprobación o cuentas abiertas cobradas en este turno, el
          cierre se detendrá y te dirá cuáles son.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('caja.seguirTrabajando')}
          </Button>
          <Button
            disabled={total <= 0}
            loading={closeShift.isPending}
            onClick={() =>
              closeShift.mutate(
                { declared_cash: total.toFixed(2), breakdown },
                { onSuccess: onClose },
              )
            }
          >
            Declarar {formatMoney(total)} y cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CashMovementDialog({
  shift,
  direction,
  onClose,
}: {
  shift: Shift
  direction: 'IN' | 'OUT'
  onClose: () => void
}) {
  const { t } = useTranslation()
  const movement = useCashMovement(shift.id)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const isOut = direction === 'OUT'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isOut ? t('caja.retirarABoveda') : t('caja.meterCambio')}</DialogTitle>
          <DialogDescription>
            {isOut ? t('caja.sacarDineroDelCajon') : t('caja.agregarCambioOFondo')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="movement-amount">{t('caja.importe')}</Label>
            <Input
              id="movement-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 text-right text-lg tabular"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="movement-note">{t('caja.descripcion')}</Label>
            <Input
              id="movement-note"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={isOut ? t('caja.entregaAGerencia') : t('caja.cambioDeLaCajaFuerte')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('caja.cancelar')}
          </Button>
          <Button
            disabled={toNumber(amount) <= 0}
            loading={movement.isPending}
            onClick={() =>
              movement.mutate(
                {
                  direction,
                  amount,
                  reason: isOut ? 'DROP' : 'REFILL',
                  description,
                },
                { onSuccess: onClose },
              )
            }
          >
            {t('caja.registrar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
