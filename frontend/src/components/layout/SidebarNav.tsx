/**
 * La lista de navegacion, compartida por el cajon de celular y el menu fijo de
 * escritorio.
 *
 * Vive aparte porque son dos presentaciones del mismo menu. Duplicarla
 * significaria que una seccion nueva aparece en escritorio y no en celular, y
 * ese es justo el tipo de diferencia que nadie nota hasta que limpieza reporta
 * que "no le sale" una pantalla.
 *
 * Las alturas van al reves de lo habitual: h-11 es la base, porque son 44px, la
 * zona tactil minima; lg:h-9 la reduce solo cuando ya hay raton.
 */
import { NavLink } from 'react-router-dom'

import { NAV_GROUPS } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'

interface Props {
  expanded: boolean
  onNavigate?: () => void
}

export function SidebarNav({ expanded, onNavigate }: Props) {
  const user = useAuthStore((state) => state.user)

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessSection(user, item.section)),
  })).filter((group) => group.items.length > 0)

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin px-2 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          {expanded ? (
            <p className="px-3 pb-1.5 text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </p>
          ) : (
            <div className="mx-2.5 mb-2 border-t border-sidebar-border" />
          )}

          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-11 items-center gap-2.5 rounded-md text-sm outline-none lg:h-9',
                      'transition-colors duration-150',
                      'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40',
                      isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground active:scale-[0.98]',
                      expanded ? 'px-3' : 'justify-center px-0',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-accent transition-all duration-200',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <item.icon
                        className={cn(
                          'h-5 w-5 shrink-0 transition-transform duration-150 lg:h-4 lg:w-4',
                          !isActive && 'group-hover:scale-110',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'truncate transition-opacity duration-150',
                          expanded ? 'opacity-100' : 'w-0 opacity-0',
                        )}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
