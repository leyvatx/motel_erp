import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import i18n from '@/lib/i18n'
import { ErrorState } from '@/components/ui/states'

interface Props {
  children: ReactNode
  /** Etiqueta de la zona que envuelve; sale en el aviso al usuario. */
  zona?: string
}

interface State {
  error: Error | null
}

/** La red de seguridad de último recurso.
 *
 *  Una excepción durante el render desmonta el árbol entero y deja una pantalla
 *  blanca: sin texto, sin botón, sin forma de saber si fue la aplicación o la
 *  conexión. Para quien está en el mostrador con alguien esperando, eso es
 *  indistinguible de "el sistema se cayó".
 *
 *  Esto no arregla el error -- lo captura para que la salida siga existiendo:
 *  reintentar (vuelve a montar el árbol) o cerrar la sesión (por si el estado
 *  guardado es lo que está podrido). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sin servicio de telemetría todavía: al menos que quede en la consola con
    // el componente que reventó, que es lo que se pide en un reporte.
    console.error(`[${this.props.zona ?? 'app'}]`, error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <ErrorState
          title={i18n.t('comun.algoSeRompio')}
          description={i18n.t('comun.errorRegistrado')}
          onRetry={() => this.setState({ error: null })}
          secondaryAction={
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem('erp-auth')
                window.location.assign('/login')
              }}
            >
              Cerrar sesión
            </Button>
          }
        />
      </div>
    )
  }
}
