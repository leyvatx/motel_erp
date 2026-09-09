import { PiCheck, PiRocketLaunch } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSetupStatus } from '@/features/onboarding/hooks'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui'

export function SetupChecklist() {
  const { t } = useTranslation()
  const { steps, pending, loading, applies } = useSetupStatus()
  const reopen = useUiStore((state) => state.reopenSetup)

  if (!applies || loading || pending.length === 0) return null

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PiRocketLaunch className="h-4 w-4 text-primary" aria-hidden />
          {t('asistente.terminaDeConfigurar')}
        </CardTitle>
        <CardDescription>
          {t('asistente.faltanPasosParaRentar', {
            restantes: pending.length,
            total: steps.length,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-end justify-between gap-4">
        <ul className="space-y-1.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  step.done
                    ? 'border-status-available bg-status-available text-white'
                    : 'border-muted-foreground/40',
                )}
                aria-hidden
              >
                {step.done ? <PiCheck className="h-2.5 w-2.5" /> : null}
              </span>
              <span className={cn(step.done && 'text-muted-foreground line-through')}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>

        <Button size="sm" onClick={reopen}>
          {t('asistente.continuarConfiguracion')}
        </Button>
      </CardContent>
    </Card>
  )
}
