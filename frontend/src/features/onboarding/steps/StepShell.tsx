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
}: {
  children: ReactNode
  valid: boolean
  submitting: boolean
  onSubmit: () => void
  submitLabel?: string
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
      <Button type="submit" className="w-full" disabled={!valid} loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
