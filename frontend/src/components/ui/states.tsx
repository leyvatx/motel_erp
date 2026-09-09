import type { ReactNode } from 'react'
import { PiPlugsConnected, PiWarningCircle } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
  title,
  description,
  onRetry,
  retrying,
  secondaryAction,
  className,
}: ErrorProps) {
  const { t } = useTranslation()
  const titulo = title ?? t('comun.noSePudoCargar')
  const detalle = description ?? t('comun.informacionNoLlego')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      <PiWarningCircle className="mb-1 h-8 w-8 text-status-cleaning" aria-hidden />
      <p className="text-sm font-medium">{titulo}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{detalle}</p>
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
  const { t } = useTranslation()
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
      <span className="sr-only">{t('comun.cargando')}</span>
    </div>
  )
}

/** Sin red: distinto de "vacío" y distinto de "falló". Se reintenta solo. */
export function OfflineState({
  titulo,
  descripcion,
  className,
}: {
  titulo?: string
  descripcion?: string
  className?: string
}) {
  const { t } = useTranslation()
  const encabezado = titulo ?? t('comun.sinConexion')
  const detalle = descripcion ?? t('comun.sinRedGeneral')
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
      role="status"
    >
      <PiPlugsConnected
        className="mb-1 h-8 w-8 animate-pulse-alert text-status-cleaning"
        aria-hidden
      />
      <p className="text-sm font-medium">{encabezado}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{detalle}</p>

      {/* Recargar, no "reintentar la consulta".
       *
       *  Cuando el navegador se declara sin red, la biblioteca de datos deja
       *  las consultas en pausa y **ignora la orden de recargar**: se probó, y
       *  el botón no hacía absolutamente nada. Prometer "vuelve solo" y dejar
       *  un botón muerto es peor que no poner botón.
       *
       *  Recargar la aplicación sí funciona siempre -- se verificó con el
       *  servidor apagado y encendido de nuevo -- y es además lo que la persona
       *  iba a hacer por su cuenta. Nada se pierde: no hay formularios abiertos
       *  detrás de esta pantalla, porque esta pantalla aparece justamente
       *  cuando no se pudo cargar nada. */}
      <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
        {t('comun.reintentarAhora')}
      </Button>
    </div>
  )
}

/** En qué situación está una consulta, con el nombre que le daría un operador.
 *
 *  React Query distingue dos ejes -- si hay datos (`status`) y si está pidiendo
 *  (`fetchStatus`) -- y la combinación que importa aquí es fácil de perder:
 *  **sin red, una consulta sin datos queda `pending` + `paused`**, que no es
 *  `isLoading` ni `isError`. Las pantallas caían entonces en su rama de "no hay
 *  nada", y una recepcionista sin Wi-Fi leía "todavía no hay habitaciones dadas
 *  de alta" -- con botón para crearlas -- sobre un negocio con cuarenta y dos.
 *
 *  Decirlo una vez y en un solo lugar es lo que evita que la próxima pantalla
 *  vuelva a equivocarse igual.
 *
 *  Con `networkMode: 'always'` en el cliente de consultas, `paused` ya no
 *  debería aparecer: se dejó esta rama porque el fallo que provocó -- una
 *  pantalla que decía "no hay habitaciones" sobre un negocio con cuarenta y
 *  dos -- vuelve solo con que alguien fije otro `networkMode` en una consulta
 *  suelta. Aquí cuesta tres líneas; allá costaba credibilidad.
 */
export type EstadoConsulta = 'error' | 'sin-conexion' | 'cargando' | 'listo'

export function estadoDeConsulta(consulta: {
  isError: boolean
  isPending: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
}): EstadoConsulta {
  if (consulta.isError) return 'error'
  if (consulta.isPending && consulta.fetchStatus === 'paused') return 'sin-conexion'
  if (consulta.isPending) return 'cargando'
  return 'listo'
}
