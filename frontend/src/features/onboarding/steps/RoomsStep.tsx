import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { StepField, StepShell } from '@/features/onboarding/steps/StepShell'
import { configApi } from '@/features/config/api'
import { useBusinessProfile } from '@/features/config/hooks'
import { useRoomTypes } from '@/features/frontdesk/hooks'
import { apiErrorMessage } from '@/lib/axios'

const MAXIMO = 200

/** Cuántas habitaciones proponer para cada franja declarada en el registro.
 *
 *  Es la misma tabla del servidor. No es un límite ni una promesa: es el número
 *  con el que la mayoría de esa franja termina, para que el campo llegue con
 *  algo razonable en vez de con un 10 fijo que no le queda a casi nadie. */
const CUARTOS_SUGERIDOS: Record<string, number> = {
  '1-10': 10,
  '11-30': 20,
  '31-50': 40,
  '50+': 60,
}

export function RoomsStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data: types } = useRoomTypes()
  const opciones = types?.results ?? []

  /* Lo que ya contestó al registrarse no se vuelve a preguntar.
   *
   *  El alta pide el tamaño de la operación; llegar aquí a una casilla vacía
   *  -- o peor, a un 10 fijo que no le queda -- es preguntar dos veces lo
   *  mismo. Se propone su cifra y se dice de dónde salió, para que corregirla
   *  sea evidente y no parezca un dato inventado. */
  const negocio = useBusinessProfile()
  const franja = negocio.data?.operation_size ?? ''
  const sugerido = CUARTOS_SUGERIDOS[franja]

  const [roomType, setRoomType] = useState('')
  const [cantidad, setCantidad] = useState('10')
  const [inicio, setInicio] = useState('101')
  const [floor, setFloor] = useState('1')
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)

  /* El perfil llega después del primer render, así que el valor no puede salir
   *  de `useState`: ahí se evalúa una vez, cuando la consulta todavía no
   *  respondió, y no se vuelve a mirar. Solo se copia mientras nadie lo haya
   *  tocado, para no pisar lo que la persona acaba de escribir. */
  const tocado = useRef(false)
  useEffect(() => {
    if (!tocado.current && sugerido !== undefined) setCantidad(String(sugerido))
  }, [sugerido])

  const primerTipo = opciones[0]
  const tipo = roomType || (primerTipo ? String(primerTipo.id) : '')
  const total = Number(cantidad)
  const primera = Number(inicio)
  const valid =
    tipo !== '' && Number.isInteger(total) && total > 0 && total <= MAXIMO && primera > 0

  /** No hay alta masiva en la API, así que van una por una. Si truena a la
   *  mitad, el número inicial avanza hasta donde llegó: reintentar continúa en
   *  vez de chocar contra las que ya existen. */
  const crear = async (): Promise<void> => {
    setProgreso({ hechas: 0, total })
    let hechas = 0

    try {
      for (let i = 0; i < total; i += 1) {
        await configApi.createRoom({
          number: String(primera + i),
          room_type: Number(tipo),
          floor: Number(floor) || 1,
        })
        hechas += 1
        setProgreso({ hechas, total })
      }
      toast.success('Habitaciones creadas', `${hechas} listas para rentar.`)
      onDone()
    } catch (error) {
      setInicio(String(primera + hechas))
      setCantidad(String(total - hechas))
      toast.error(
        hechas > 0 ? `Se crearon ${hechas} de ${total}` : 'No se pudo crear la primera habitación',
        apiErrorMessage(error),
      )
    } finally {
      setProgreso(null)
      await queryClient.invalidateQueries({ queryKey: ['frontdesk'] })
    }
  }

  const porcentaje = progreso ? Math.round((progreso.hechas / progreso.total) * 100) : 0

  return (
    <StepShell
      valid={valid}
      submitting={progreso !== null}
      onSubmit={() => void crear()}
      submitLabel={valid ? `Crear ${total} habitaciones` : 'Crear habitaciones'}
    >
      {opciones.length > 1 ? (
        <StepField label="De qué tipo" htmlFor="setup-rooms-type">
          <Select value={tipo} onValueChange={setRoomType}>
            <SelectTrigger id="setup-rooms-type">
              <SelectValue placeholder="Elige el tipo" />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <StepField label="Cuántas" htmlFor="setup-rooms-count">
          <Input
            id="setup-rooms-count"
            type="number"
            min={1}
            max={MAXIMO}
            value={cantidad}
            onChange={(event) => {
              tocado.current = true
              setCantidad(event.target.value)
            }}
            autoFocus
          />
        </StepField>

        <StepField label="Desde el número" htmlFor="setup-rooms-start">
          <Input
            id="setup-rooms-start"
            type="number"
            min={1}
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
          />
        </StepField>

        <StepField label="Piso" htmlFor="setup-rooms-floor">
          <Input
            id="setup-rooms-floor"
            type="number"
            min={1}
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
          />
        </StepField>
      </div>

      {progreso ? (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Creando {progreso.hechas} de {progreso.total}…
          </p>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {!valid
            ? 'Indica cuántas habitaciones tiene este piso.'
            : sugerido !== undefined && !tocado.current
              ? `Se numerarán de la ${primera} a la ${primera + total - 1}. Tomamos ${sugerido} de lo que nos dijiste al registrarte; cámbialo si no es exacto.`
              : `Se numerarán de la ${primera} a la ${primera + total - 1}.`}
        </p>
      )}
    </StepShell>
  )
}
