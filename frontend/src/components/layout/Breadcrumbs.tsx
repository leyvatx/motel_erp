import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PiCaretRight } from 'react-icons/pi'

const LABELS: Record<string, string> = {
  frontdesk: 'Recepción',
  inventory: 'Inventarios',
  housekeeping: 'Ama de llaves',
  finances: 'Finanzas',
  reports: 'Reportes',
  audit: 'Auditoría',
  users: 'Usuarios',
  config: 'Configuración',
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const path = `/${segments.slice(0, index + 1).join('/')}`
          const isLast = index === segments.length - 1
          const label = LABELS[segment] ?? segment

          return (
            <Fragment key={path}>
              {index > 0 ? (
                <PiCaretRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
              ) : null}
              <li>
                {isLast ? (
                  <span className="font-medium">{label}</span>
                ) : (
                  <Link
                    to={path}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
