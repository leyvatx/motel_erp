import { useState } from 'react'
import { PiCaretRightBold, PiBed } from 'react-icons/pi'

import { SidebarNav } from '@/components/layout/SidebarNav'
import { useBrand } from '@/features/config/hooks'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'

export function Sidebar() {
  const pinnedCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggle = useUiStore((state) => state.toggleSidebar)
  const user = useAuthStore((state) => state.user)
  const { name: businessName, logoUrl } = useBrand()
  const [hovered, setHovered] = useState(false)
  // ponytail: canHover evita que el sidebar se quede abierto al colapsarlo con el cursor encima
  const [canHover, setCanHover] = useState(true)

  const expanded = !pinnedCollapsed || (hovered && canHover)
  const floating = pinnedCollapsed && hovered && canHover

  const handleToggle = (): void => {
    if (expanded) setCanHover(false)
    toggle()
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setCanHover(true)
      }}
      className={cn(
        'relative hidden shrink-0 transition-[width] duration-200 lg:block',
        pinnedCollapsed ? 'w-[3.75rem]' : 'w-64',
      )}
    >
      <aside
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
          'transition-[width,box-shadow] duration-200 ease-out',
          expanded ? 'w-64' : 'w-[3.75rem]',
          floating && 'shadow-xl',
        )}
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border',
            expanded ? 'px-3' : 'justify-center px-0',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-dark">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <PiBed className="h-4 w-4 text-white" aria-hidden />
            )}
          </div>
          <div
            className={cn(
              'min-w-0 leading-tight transition-opacity duration-150',
              expanded ? 'opacity-100' : 'w-0 opacity-0',
            )}
          >
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              {businessName || 'Motel ERP'}
            </p>
            <p className="truncate text-2xs text-sidebar-foreground/70">Administración</p>
          </div>
        </div>

        <SidebarNav expanded={expanded} />

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-md py-2',
              expanded ? 'px-2' : 'justify-center px-0',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-2xs font-semibold text-sidebar-accent-foreground">
              {user?.full_name.slice(0, 2).toUpperCase()}
            </span>
            <div
              className={cn(
                'min-w-0 leading-tight transition-opacity duration-150',
                expanded ? 'opacity-100' : 'w-0 opacity-0',
              )}
            >
              <p className="truncate text-xs font-medium text-sidebar-accent-foreground">
                {user?.full_name}
              </p>
              <p className="truncate text-2xs text-sidebar-foreground/70">{user?.role_display}</p>
            </div>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'absolute top-1/2 z-50 grid h-24 w-4 -translate-y-1/2 place-items-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/70 shadow-md transition-[left,color] duration-200 hover:text-sidebar-accent-foreground',
          expanded ? 'left-[15.5rem]' : 'left-[3.25rem]',
        )}
        aria-label={pinnedCollapsed ? 'Anclar menú abierto' : 'Colapsar menú'}
        aria-expanded={expanded}
        title={pinnedCollapsed ? 'Anclar menú abierto' : 'Colapsar menú'}
      >
        <PiCaretRightBold
          className={cn('h-3 w-3 transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>
    </div>
  )
}
