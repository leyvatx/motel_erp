import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  description?: string
  actions?: ReactNode
  /** Franja de métricas o filtros que va bajo el encabezado, sin desplazarse. */
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Armazón de una página de altura fija.
 *
 * La pantalla nunca se desplaza: encabezado y barra de herramientas quedan
 * anclados y solo el contenido -- normalmente una tabla -- tiene su propio
 * scroll. Así el usuario conserva siempre a la vista los encabezados de
 * columna y la paginación.
 */
export function PageShell({ title, description, actions, toolbar, children, className }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={title} description={description} actions={actions} />
      {toolbar}
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
    </div>
  )
}

/**
 * Contenedor de tabla con scroll propio.
 *
 * `min-h-0` es lo que permite que el hijo se encoja dentro de un flex y
 * aparezca su barra de desplazamiento en lugar de empujar la página.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">{children}</div>
}
