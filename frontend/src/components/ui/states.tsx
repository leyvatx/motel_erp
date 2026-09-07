import type { ReactNode } from 'react'
import { PiPlugsConnected, PiWarningCircle } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Los cuatro finales posibles de cualquier pantalla, en un solo sitio.
 *
 *  Antes cada módulo escribía su propio "No hay datos." y su propio texto de
 *  error. El resultado es que la misma situación se ve distinta según dónde
 *  ocurra, y ninguno de esos textos decía qué hacer a continuación. Estos tres
 *  componentes siempre dan una salida: una acción, o al menos una frase que
 *  explica por qué la pantalla está vacía. */

interface EmptyProps {
  /** Qué falta, en lenguaje de operación. */
  title: string
  /** Por qué está vacío y qué lo llenaría. */
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-1 text-muted-foreground/50">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

interface ErrorProps {
  title?: string
  description?: ReactNode
  onRetry?: () => void
  retrying?: boolean
  /** Segunda salida cuando reintentar no sirve: salir de la sesión, volver. */
  secondaryAction?: ReactNode
  className?: string
}

export function ErrorState({
  title = 'No se pudo cargar',
  description = 'La información no llegó. Puede ser la conexión o que el servidor esté despertando.',
  onRetry,
  retrying,
  secondaryAction,
  className,
}: ErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      <PiWarningCircle className="mb-1 h-8 w-8 text-status-cleaning" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button variant="outline" onClick={onRetry} loading={retrying}>
            Reintentar
          </Button>
        ) : null}
        {secondaryAction}
      </div>
    </div>
  )
}

/** Espera con la forma de lo que viene, no un giro sobre fondo vacío. */
export function LoadingState({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
      <span className="sr-only">Cargando</span>
    </div>
  )
}

/** Sin red: distinto de "vacío" y distinto de "falló". Se reintenta solo. */
export function OfflineState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <PiPlugsConnected className="h-4 w-4 animate-pulse-alert" aria-hidden />
      Sin conexión con el servidor. Reintentando…
    </div>
  )
}
