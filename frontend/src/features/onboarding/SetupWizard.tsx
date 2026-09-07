import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PiCheckCircle } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BusinessStep } from '@/features/onboarding/steps/BusinessStep'
import { RoomTypeStep } from '@/features/onboarding/steps/RoomTypeStep'
import { RoomsStep } from '@/features/onboarding/steps/RoomsStep'
import { TariffStep } from '@/features/onboarding/steps/TariffStep'
import { useSetupStatus, type SetupStepId } from '@/features/onboarding/hooks'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui'

function Progreso({
  total,
  hechos,
}: {
  total: number
  hechos: number
}) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-200',
            index < hechos ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}

export function SetupWizard() {
  const navigate = useNavigate()
  const { steps, pending, loading, applies } = useSetupStatus()
  const dismissed = useUiStore((state) => state.setupDismissed)
  const dismiss = useUiStore((state) => state.dismissSetup)

  /** Los pasos que se acaban de completar en esta sesión del asistente. Sin
   *  esto habría que esperar a que las consultas se refresquen para avanzar, y
   *  el paso recién guardado se quedaría en pantalla unos cuantos cientos de
   *  milisegundos. */
  const [recienHechos, setRecienHechos] = useState<SetupStepId[]>([])

  const restantes = pending.filter((step) => !recienHechos.includes(step.id))
  const actual = restantes[0]
  const terminado = recienHechos.length > 0 && restantes.length === 0
  const open = applies && !loading && !dismissed && (pending.length > 0 || terminado)

  const cerrar = (): void => {
    dismiss()
    setRecienHechos([])
  }

  const completar = (id: SetupStepId): void => setRecienHechos((previos) => [...previos, id])

  return (
    <Dialog
      open={open}
      onOpenChange={(siguiente) => {
        if (!siguiente) cerrar()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {terminado || !actual ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PiCheckCircle className="h-5 w-5 text-status-available" aria-hidden />
                Todo listo
              </DialogTitle>
              <DialogDescription>
                Ya puedes rentar. Lo demás -- inventario, usuarios, precios especiales -- se
                configura cuando lo necesites.
              </DialogDescription>
            </DialogHeader>

            <Button
              className="w-full"
              onClick={() => {
                cerrar()
                navigate('/frontdesk')
              }}
            >
              Ir a Recepción
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{actual.label}</DialogTitle>
              <DialogDescription>{actual.hint}</DialogDescription>
            </DialogHeader>

            <Progreso total={steps.length} hechos={steps.length - restantes.length} />

            {actual.id === 'business' ? <BusinessStep onDone={() => completar('business')} /> : null}
            {actual.id === 'roomType' ? (
              <RoomTypeStep onDone={() => completar('roomType')} />
            ) : null}
            {actual.id === 'tariff' ? <TariffStep onDone={() => completar('tariff')} /> : null}
            {actual.id === 'rooms' ? <RoomsStep onDone={() => completar('rooms')} /> : null}

            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Faltan {restantes.length} de {steps.length}
              </p>
              <Button variant="ghost" size="sm" onClick={cerrar}>
                Saltar por ahora
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
