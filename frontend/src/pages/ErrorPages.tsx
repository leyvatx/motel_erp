import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/states'

function Shell({ code, title, message }: { code: string; title: string; message: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-6xl font-bold text-brand-accent">{code}</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('comun.volverAlInicio')}</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Shell
      code="404"
      title={t('comun.paginaNoEncontrada')}
      message={t('comun.direccionNoExiste')}
    />
  )
}

export function ForbiddenPage() {
  const { t } = useTranslation()
  return <Shell code="403" title={t('comun.sinAcceso')} message={t('comun.rolSinPermiso')} />
}

/** Lo que React Router pinta cuando una ruta revienta al cargar o al render.
 *
 *  Cubre el hueco que el `ErrorBoundary` de clase no ve: el fallo dentro de un
 *  `lazy()` -- un chunk que no bajó porque se desplegó una versión nueva
 *  mientras la pestaña estaba abierta -- que el router atrapa antes que nadie.
 *  Recargar es justo lo que arregla ese caso, así que es la acción principal. */
export function RouteErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : null

  if (status === 404) return <NotFoundPage />
  if (status === 403) return <ForbiddenPage />

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <ErrorState
        title={t('comun.pantallaNoAbrio')}
        description={t('comun.versionNueva')}
        onRetry={() => window.location.reload()}
        secondaryAction={
          <Button asChild variant="ghost">
            <Link to="/">{t('comun.irAlInicio')}</Link>
          </Button>
        }
      />
    </div>
  )
}
