import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/states'

function Shell({ code, title, message }: { code: string; title: string; message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-6xl font-bold text-brand-accent">{code}</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <Shell
      code="404"
      title="Página no encontrada"
      message="La dirección que abriste no existe o cambio de lugar."
    />
  )
}

export function ForbiddenPage() {
  return (
    <Shell
      code="403"
      title="Sin acceso"
      message="Tu rol no tiene permiso para entrar a esta seccion. Si crees que es un error, habla con gerencia."
    />
  )
}

/** Lo que React Router pinta cuando una ruta revienta al cargar o al render.
 *
 *  Cubre el hueco que el `ErrorBoundary` de clase no ve: el fallo dentro de un
 *  `lazy()` -- un chunk que no bajó porque se desplegó una versión nueva
 *  mientras la pestaña estaba abierta -- que el router atrapa antes que nadie.
 *  Recargar es justo lo que arregla ese caso, así que es la acción principal. */
export function RouteErrorPage() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : null

  if (status === 404) return <NotFoundPage />
  if (status === 403) return <ForbiddenPage />

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <ErrorState
        title="Esta pantalla no pudo abrirse"
        description="Suele pasar cuando se publicó una versión nueva con la pestaña abierta. Recargar la trae completa."
        onRetry={() => window.location.reload()}
        secondaryAction={
          <Button asChild variant="ghost">
            <Link to="/">Ir al inicio</Link>
          </Button>
        }
      />
    </div>
  )
}
