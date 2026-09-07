import { useRef, useState } from 'react'
import { PiImageSquare } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StepField, StepShell } from '@/features/onboarding/steps/StepShell'
import { useBusinessProfile, useUpdateBusinessLogo, useUpdateBusinessProfile } from '@/features/config/hooks'

export function BusinessStep({ onDone }: { onDone: () => void }) {
  const profile = useBusinessProfile()
  const updateProfile = useUpdateBusinessProfile()
  const updateLogo = useUpdateBusinessLogo()

  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.data?.name ?? '')
  const [logo, setLogo] = useState<File | null>(null)

  const submit = async (): Promise<void> => {
    await updateProfile.mutateAsync({ name: name.trim() })
    // El logotipo va aparte porque viaja como multipart y puede no venir.
    if (logo) await updateLogo.mutateAsync(logo)
    onDone()
  }

  return (
    <StepShell
      valid={name.trim().length > 1}
      submitting={updateProfile.isPending || updateLogo.isPending}
      onSubmit={() => void submit()}
    >
      <StepField
        label="¿Cómo se llama tu negocio?"
        htmlFor="setup-name"
        hint="Es lo que verán tus empleados en el menú y tus clientes en el ticket."
      >
        <Input
          id="setup-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sucursal Centro"
          autoFocus
        />
      </StepField>

      <StepField label="Logotipo (opcional)" htmlFor="setup-logo">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {logo ? (
              <img src={URL.createObjectURL(logo)} alt="" className="h-full w-full object-contain" />
            ) : (
              <PiImageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <PiImageSquare />
            {logo ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          <input
            id="setup-logo"
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
          />
        </div>
      </StepField>
    </StepShell>
  )
}
