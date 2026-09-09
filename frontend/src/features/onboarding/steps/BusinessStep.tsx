import { useEffect, useRef, useState } from 'react'
import { PiImageSquare } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StepField, StepShell } from '@/features/onboarding/steps/StepShell'
import {
  useBusinessProfile,
  useUpdateBusinessLogo,
  useUpdateBusinessProfile,
} from '@/features/config/hooks'
import { apiErrorMessage } from '@/lib/axios'

/** Mismo tope que valida el servidor para el logotipo. */
const MAX_BYTES = 512 * 1024

export function BusinessStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const profile = useBusinessProfile()
  const updateProfile = useUpdateBusinessProfile()
  const updateLogo = useUpdateBusinessLogo()

  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)

  /** El nombre que ya tiene el negocio, en cuanto llega.
   *
   *  Antes esto era `useState(profile.data?.name ?? '')`, que se evalúa en el
   *  primer render -- cuando la consulta todavía no ha resuelto -- y no se
   *  vuelve a mirar nunca. El campo se quedaba vacío aunque el negocio ya
   *  tuviera nombre (el que se escribió al registrarse), y como "Continuar" se
   *  habilita con el nombre, el botón aparecía muerto sin decir por qué.
   *
   *  Sólo se copia mientras el usuario no haya escrito: si ya está editando,
   *  una respuesta tardía no puede pisarle lo tecleado. */
  const tocado = useRef(false)
  const nombreGuardado = profile.data?.name ?? ''
  useEffect(() => {
    if (!tocado.current && nombreGuardado) setName(nombreGuardado)
  }, [nombreGuardado])

  // La vista previa es un blob: se revoca al cambiarla o al salir, porque una
  // imagen de cámara ocupa varios MB hasta que se suelta.
  useEffect(() => {
    if (!logo) {
      setVistaPrevia(null)
      return
    }
    const url = URL.createObjectURL(logo)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  const elegirLogo = (archivo: File | undefined): void => {
    if (!archivo) return
    if (archivo.size > MAX_BYTES) {
      setErrorArchivo(t('asistente.logotipoPesado'))
      return
    }
    setErrorArchivo(null)
    setLogo(archivo)
  }

  const nombreListo = name.trim().length > 1
  const logoListo = Boolean(logo) || Boolean(profile.data?.logo_url)

  /** Qué falta para poder continuar, dicho en voz alta.
   *
   *  Un botón gris sin explicación es la forma más rápida de que alguien
   *  abandone el asistente: no sabe si el sistema está roto o si le falta algo. */
  const falta = !nombreListo
    ? t('asistente.escribeElNombre')
    : !logoListo
      ? t('asistente.subeUnLogotipo')
      : null

  const submit = async (): Promise<void> => {
    await updateProfile.mutateAsync({ name: name.trim() })
    // El logotipo va aparte porque viaja como multipart y puede no venir.
    if (logo) await updateLogo.mutateAsync(logo)
    onDone()
  }

  const guardando = updateProfile.isPending || updateLogo.isPending
  const errorGuardado =
    updateProfile.isError || updateLogo.isError
      ? apiErrorMessage(updateProfile.error ?? updateLogo.error, t('asistente.noSePudoGuardar'))
      : null

  return (
    <StepShell
      valid={nombreListo}
      submitting={guardando}
      onSubmit={() => void submit()}
      // El nombre es obligatorio; el logotipo no. Cuando sólo falta el
      // logotipo, el botón lo dice en vez de prometer algo que no se hizo.
      submitLabel={nombreListo && !logoListo ? t('asistente.continuarSinLogotipo') : 'Continuar'}
      ayuda={falta}
      loading={profile.isPending}
    >
      <StepField
        label={t('asistente.comoSeLlama')}
        htmlFor="setup-name"
        hint={t('asistente.esLoQueVeran')}
      >
        <Input
          id="setup-name"
          value={name}
          onChange={(event) => {
            tocado.current = true
            setName(event.target.value)
          }}
          placeholder="Sucursal Centro"
          autoFocus
        />
      </StepField>

      <StepField label="Logotipo (opcional)" htmlFor="setup-logo">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {(vistaPrevia ?? profile.data?.logo_url) ? (
              <img
                src={vistaPrevia ?? profile.data?.logo_url ?? ''}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <PiImageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <PiImageSquare />
            {(logo ?? profile.data?.logo_url) ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          <input
            id="setup-logo"
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(event) => elegirLogo(event.target.files?.[0])}
          />
        </div>
        {errorArchivo ? <p className="mt-2 text-xs text-destructive">{errorArchivo}</p> : null}
      </StepField>

      {errorGuardado ? (
        <p role="alert" className="text-sm text-destructive">
          {errorGuardado}
        </p>
      ) : null}
    </StepShell>
  )
}
