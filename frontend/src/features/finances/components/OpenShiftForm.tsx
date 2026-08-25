import { useState } from 'react'
import { PiLockOpen, PiMoney } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import {
  CashBreakdownInput,
  breakdownTotal,
} from '@/features/finances/components/CashBreakdownInput'
import { useOpenShift } from '@/features/finances/hooks'
import type { CashBreakdown } from '@/features/finances/types'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/store/auth'

export function OpenShiftForm({ onOpened }: { onOpened?: () => void }) {
  const cashier = useAuthStore((state) => state.user)
  const openShift = useOpenShift()
  const [breakdown, setBreakdown] = useState<CashBreakdown>({})

  const total = breakdownTotal(breakdown)
  const done = { onSuccess: () => onOpened?.() }

  return (
    <>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <PiMoney className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Fondo inicial</p>
        </div>

        <CashBreakdownInput
          value={breakdown}
          onChange={setBreakdown}
          total={total}
          label="Fondo a declarar"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Se abrirá a nombre de <span className="font-medium">{cashier?.full_name}</span>.
        </p>
        <div className="flex gap-2">
          {total === 0 ? (
            <Button
              variant="outline"
              loading={openShift.isPending}
              onClick={() => openShift.mutate({ opening_balance: '0.00' }, done)}
            >
              Abrir sin fondo
            </Button>
          ) : null}
          <Button
            size="lg"
            disabled={total === 0}
            loading={openShift.isPending}
            onClick={() =>
              openShift.mutate({ opening_balance: total.toFixed(2), breakdown }, done)
            }
          >
            <PiLockOpen />
            Abrir turno con {formatMoney(total)}
          </Button>
        </div>
      </div>
    </>
  )
}
