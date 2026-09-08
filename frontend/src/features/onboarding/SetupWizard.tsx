import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PiArrowLeft, PiCheckCircle } from 'react-icons/pi'

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
import { defaultRouteFor, useAuthStore } from '@/store/auth'
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
  const user = useAuthStore((state) => state.user)
  const dismissed = useUiStore((state) => state.setupDismissed)
  const dismiss = useUiStore((state) => state.dismissSetup)

  /** Los pasos que se acaban de completar en esta sesión del asistente. Sin
   *  esto habría que esperar a que las consultas se refresquen para avanzar, y
   *  el paso recién guardado se quedaría en pantalla unos cuantos cientos de
   *  milisegundos. */
  const [recienHechos, setRecienHechos] = useState<SetupStepId[]>([])

  /** Un paso al que se volvió con "Atrás". Manda sobre el orden natural.
   *
   *  Sin esto el asistente solo sabía avanzar: quien se equivocaba al escribir
   *  el nombre tenía que terminar los cuatro pasos y buscar Configuración. */
  const [revisando, setRevisando] = useState<SetupStepId | null>(null)

  const restantes = pending.filter((step) => !recienHechos.includes(step.id))
  const actual = revisando ? steps.find((step) => step.id === revisando) : restantes[0]

  /** El paso anterior al que se está viendo, si lo hay. */
  const indiceActual = actual ? steps.findIndex((step) => step.id === actual.id) : -1
  const anterior = indiceActual > 0 ? steps[indiceActual - 1] : undefined
  const terminado = recienHechos.length > 0 && restantes.length === 0
  const open = applies && !loading && !dismissed && (pending.length > 0 || terminado)

  // Quien acaba de configurar es dueño o gerente, y su pantalla es el tablero;
  // recepción cae en Recepción. Mandar a todos al mismo sitio hacía que el
  // administrador terminara el asistente en una pantalla que no es la suya.
  const destino = defaultRouteFor(user)

  const cerrar = (): void => {
    dismiss()
    setRecienHechos([])
  }

  const completar = (id: SetupStepId): void => {
    setRecienHechos((previos) => (previos.includes(id) ? previos : [...previos, id]))
    setRevisando(null)
  }

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
                navigate(destino)
              }}
            >
              {destino === '/frontdesk' ? 'Ir a Recepción' : 'Ir al tablero'}
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
              {anterior ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevisando(anterior.id)}
                  className="-ml-2"
                >
                  <PiArrowLeft />
                  {anterior.label}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Faltan {restantes.length} de {steps.length}
                </p>
              )}
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
