import { PiLock } from 'react-icons/pi'

import { Card, CardContent } from '@/components/ui/card'
import { OpenShiftForm } from '@/features/finances/components/OpenShiftForm'

export function OpenShiftScreen() {
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto scrollbar-thin py-2">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10">
              <PiLock className="h-5 w-5 text-brand-accent" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Tu caja está cerrada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para cobrar rentas, vender en mostrador o registrar gastos necesitas abrir tu turno.
                Todo lo que cobres quedará ligado a este turno y a tu usuario.
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

          <OpenShiftForm />
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
