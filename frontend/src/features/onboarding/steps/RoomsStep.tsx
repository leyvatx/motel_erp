import { useState } from 'react'
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
import { useRoomTypes } from '@/features/frontdesk/hooks'
import { apiErrorMessage } from '@/lib/axios'

const MAXIMO = 200

export function RoomsStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data: types } = useRoomTypes()
  const opciones = types?.results ?? []

  const [roomType, setRoomType] = useState('')
  const [cantidad, setCantidad] = useState('10')
  const [inicio, setInicio] = useState('101')
  const [floor, setFloor] = useState('1')
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)

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
        hechas > 0
          ? `Se crearon ${hechas} de ${total}`
          : 'No se pudo crear la primera habitación',
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
            onChange={(event) => setCantidad(event.target.value)}
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
          {valid
            ? `Se numerarán de la ${primera} a la ${primera + total - 1}.`
            : 'Indica cuántas habitaciones tiene este piso.'}
        </p>
      )}
    </StepShell>
  )
}
