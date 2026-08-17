import { useState } from 'react'
import { Banknote, Lock, Unlock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  CashBreakdownInput,
  breakdownTotal,
} from '@/features/finances/components/CashBreakdownInput'
import { useOpenShift } from '@/features/finances/hooks'
import type { CashBreakdown } from '@/features/finances/types'
import { formatMoney } from '@/lib/format'
import { useAuthStore } from '@/store/auth'

/**
 * Pantalla de arranque del turno.
 *
 * Mientras no haya turno abierto no se muestra nada más: el punto de venta no
 * puede cobrar y los gastos no pueden registrarse, así que ofrecerlos solo
 * llevaría al empleado a un error al final. Aquí hay una sola cosa que hacer.
 */
export function OpenShiftScreen() {
  const cashier = useAuthStore((state) => state.user)
  const openShift = useOpenShift()
  const [breakdown, setBreakdown] = useState<CashBreakdown>({})

  const total = breakdownTotal(breakdown)

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto scrollbar-thin py-2">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10">
              <Lock className="h-5 w-5 text-brand-accent" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Tu caja está cerrada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para cobrar rentas, vender en mostrador o registrar gastos necesitas abrir tu
                turno. Todo lo que cobres quedará ligado a este turno y a tu usuario.
              </p>
            </div>
          </div>

          <ol className="space-y-3">
            <Step number={1} title="Cuenta el fondo de caja" active>
              Captura cuántos billetes y monedas de cada denominación hay en el cajón. El sistema
              hace la suma.
            </Step>
            <Step number={2} title="Trabaja tu turno">
              Cobras rentas y ventas de mostrador, y registras gastos. Nada se captura dos veces.
            </Step>
            <Step number={3} title="Cierra con corte ciego">
              Al terminar vuelves a contar. El sistema calcula lo esperado hasta ese momento, no
              antes.
            </Step>
          </ol>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />
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
                  onClick={() => openShift.mutate({ opening_balance: '0.00' })}
                >
                  Abrir sin fondo
                </Button>
              ) : null}
              <Button
                size="lg"
                disabled={total === 0}
                loading={openShift.isPending}
                onClick={() =>
                  openShift.mutate({ opening_balance: total.toFixed(2), breakdown })
                }
              >
                <Unlock />
                Abrir turno con {formatMoney(total)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({
  number,
  title,
  children,
  active,
}: {
  number: number
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <li className="flex gap-3">
      <span
        className={
          active
            ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent text-2xs font-semibold text-white'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold text-muted-foreground'
        }
      >
        {number}
      </span>
      <div className="min-w-0">
        <p className={active ? 'text-sm font-medium' : 'text-sm font-medium text-muted-foreground'}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
