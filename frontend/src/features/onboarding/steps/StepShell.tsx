import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function StepField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StepShell({
  children,
  valid,
  submitting,
  onSubmit,
  submitLabel = 'Continuar',
  ayuda,
  loading = false,
}: {
  children: ReactNode
  valid: boolean
  submitting: boolean
  onSubmit: () => void
  submitLabel?: string
  /** Qué falta para poder avanzar. Se muestra cuando el botón está apagado. */
  ayuda?: string | null
  /** El paso todavía está trayendo lo que ya estaba guardado. */
  loading?: boolean
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !submitting) onSubmit()
      }}
    >
      <div className="space-y-3">{children}</div>

      {/* Un botón gris y mudo es la forma más rápida de que alguien abandone el
          asistente: no sabe si el sistema se rompió o si le falta algo. Cuando
          no se puede avanzar, aquí se dice exactamente qué falta. */}
      {!valid && ayuda ? (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {ayuda}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={!valid || loading}
        loading={submitting || loading}
      >
        {submitLabel}
      </Button>
    </form>
  )
}
