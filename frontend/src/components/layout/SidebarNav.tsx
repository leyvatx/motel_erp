import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { PiCaretDown } from 'react-icons/pi'

import {
  CONFIG_SECTIONS,
  DEFAULT_CONFIG_SECTION,
  NAV_GROUPS,
  configPath,
  isConfigSection,
  type NavItem,
} from '@/components/layout/navigation'
import { etiquetaDeGrupo, etiquetaDeSeccion } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'

interface Props {
  expanded: boolean
  onNavigate?: () => void
}

function linkClass(isActive: boolean, expanded: boolean): string {
  return cn(
    'group relative flex h-11 items-center gap-2.5 rounded-md text-sm outline-none lg:h-9',
    'transition-colors duration-150',
    'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40',
    isActive
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground active:scale-[0.98]',
    expanded ? 'px-3' : 'justify-center px-0',
  )
}

function ConfigSubmenu({ onNavigate }: { onNavigate?: () => void }) {
  const { search } = useLocation()
  const pedida = new URLSearchParams(search).get('seccion')
  const actual = isConfigSection(pedida) ? pedida : DEFAULT_CONFIG_SECTION

  return (
    <ul className="mb-1 ml-[1.4rem] space-y-0.5 border-l border-sidebar-border pl-2">
      {CONFIG_SECTIONS.map((section) => (
        <li key={section.value}>
          <NavLink
            to={configPath(section.value)}
            onClick={onNavigate}
            className={cn(
              'flex h-9 items-center rounded-md px-2.5 text-xs outline-none transition-colors lg:h-8',
              'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40',
              actual === section.value
                ? 'bg-sidebar-accent/60 font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
            )}
          >
            {section.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function NavEntry({
  item,
  expanded,
  onNavigate,
}: {
  item: NavItem
  expanded: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const conSubmenu = item.section === 'config' && expanded && pathname.startsWith('/config')

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) => linkClass(isActive, expanded)}
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
              {etiquetaDeSeccion(t, item.section, item.label)}
            </span>
          </>
        )}
      </NavLink>

      {conSubmenu ? <ConfigSubmenu onNavigate={onNavigate} /> : null}
    </li>
  )
}

export function SidebarNav({ expanded, onNavigate }: Props) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const navGroups = useUiStore((state) => state.navGroups)
  const toggleNavGroup = useUiStore((state) => state.toggleNavGroup)
  const { pathname } = useLocation()

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessSection(user, item.section)),
  })).filter((group) => group.items.length > 0)

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin px-2 py-3">
      {groups.map((group) => {
        // Con el menú en iconos no hay etiquetas que plegar, y esconder un grupo
        // dejaría iconos sueltos sin forma de recuperarlos.
        const dentro = group.items.some((item) => pathname.startsWith(item.to))
        const plegable = Boolean(group.collapsible) && expanded
        const abierto = !plegable || dentro || (navGroups[group.id] ?? true)

        return (
          <div key={group.id}>
            {expanded ? (
              plegable ? (
                <button
                  type="button"
                  onClick={() => toggleNavGroup(group.id)}
                  aria-expanded={abierto}
                  className="flex w-full items-center gap-1 rounded-md px-3 pb-1.5 pt-0.5 text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/50 outline-none transition-colors hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                >
                  <PiCaretDown
                    className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      abierto ? '' : '-rotate-90',
                    )}
                    aria-hidden
                  />
                  {etiquetaDeGrupo(t, group.id, group.label)}
                </button>
              ) : (
                <p className="px-3 pb-1.5 text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                  {etiquetaDeGrupo(t, group.id, group.label)}
                </p>
              )
            ) : (
              <div className="mx-2.5 mb-2 border-t border-sidebar-border" />
            )}

            {abierto ? (
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <NavEntry key={item.to} item={item} expanded={expanded} onNavigate={onNavigate} />
                ))}
              </ul>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
