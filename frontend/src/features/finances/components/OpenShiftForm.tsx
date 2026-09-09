import { useState } from 'react'
import { PiLockOpen, PiMoney } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
          <p className="text-sm font-medium">{t('caja.fondoInicial')}</p>
        </div>

        <CashBreakdownInput
          value={breakdown}
          onChange={setBreakdown}
          total={total}
          label={t('caja.fondoADeclarar')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t('caja.seAbriraANombreDe')} <span className="font-medium">{cashier?.full_name}</span>.
        </p>
        <div className="flex gap-2">
          {total === 0 ? (
            <Button
              variant="outline"
              loading={openShift.isPending}
              onClick={() => openShift.mutate({ opening_balance: '0.00' }, done)}
            >
              {t('caja.abrirSinFondo')}
            </Button>
          ) : null}
          <Button
            size="lg"
            disabled={total === 0}
            loading={openShift.isPending}
            onClick={() => openShift.mutate({ opening_balance: total.toFixed(2), breakdown }, done)}
          >
            <PiLockOpen />
            {t('caja.abrirTurnoConMonto', { monto: formatMoney(total) })}
          </Button>
        </div>
      </div>
    </>
  )
}
