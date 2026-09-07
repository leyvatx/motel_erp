import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { StepField, StepShell } from '@/features/onboarding/steps/StepShell'
import { useCreateRoomType } from '@/features/config/hooks'

/** La clave la escribe el sistema: es obligatoria para el backend y no significa
 *  nada para quien está dando de alta su negocio. */
function claveDesde(nombre: string): string {
  const letras = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z]/g, '')
  return letras.slice(0, 3).toUpperCase() || 'STD'
}

export function RoomTypeStep({ onDone }: { onDone: () => void }) {
  const create = useCreateRoomType()
  const [name, setName] = useState('')
  const [occupants, setOccupants] = useState('2')

  const submit = (): void => {
    create.mutate(
      {
        name: name.trim(),
        code: claveDesde(name),
        max_occupants: Number(occupants) || 2,
        extra_person_price: '0.00',
      },
      { onSuccess: () => onDone() },
    )
  }

  return (
    <StepShell valid={name.trim().length > 1} submitting={create.isPending} onSubmit={submit}>
      <StepField
        label="¿Qué tipo de habitación tienes?"
        htmlFor="setup-type"
        hint="Empieza por la más común. Las demás se agregan después desde Configuración."
      >
        <Input
          id="setup-type"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sencilla"
          autoFocus
        />
      </StepField>

      <StepField label="¿Cuántas personas caben?" htmlFor="setup-occupants">
        <Input
          id="setup-occupants"
          type="number"
          min={1}
          value={occupants}
          onChange={(event) => setOccupants(event.target.value)}
        />
      </StepField>
    </StepShell>
  )
}
