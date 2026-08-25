/**
 * Navegacion en celular y tableta: el mismo menu, en un cajon.
 *
 * Existe porque hasta ahora no habia ninguna. El menu lateral es hidden lg:block
 * y el boton del Topbar solo cambiaba el anclado del escritorio, asi que por
 * debajo de 1024px no se podia cambiar de seccion.
 *
 * El corte esta en lg y no en md a proposito: una tableta en vertical mide
 * 768px y un menu fijo de 256px se llevaria un tercio de la pantalla. La
 * tableta queda mejor con cajon.
 */
import { useEffect } from 'react'
import { BedDouble } from 'lucide-react'

import { SidebarNav } from '@/components/layout/SidebarNav'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useBrand } from '@/features/config/hooks'
import { useAuthStore } from '@/store/auth'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: Props) {
  const user = useAuthStore((state) => state.user)
  const { name: businessName, logoUrl } = useBrand()

  useEffect(() => {
    const escritorio = window.matchMedia('(min-width: 1024px)')
    const cerrar = (): void => {
      if (escritorio.matches) onOpenChange(false)
    }
    escritorio.addEventListener('change', cerrar)
    return () => escritorio.removeEventListener('change', cerrar)
  }, [onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        hideClose
        className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        aria-describedby={undefined}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-dark">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <BedDouble className="h-4 w-4 text-white" aria-hidden />
            )}
          </div>
          <div className="min-w-0 leading-tight">
            <SheetTitle className="truncate text-sm text-sidebar-accent-foreground">
              {businessName || 'Motel ERP'}
            </SheetTitle>
            <p className="truncate text-2xs text-sidebar-foreground/70">Administración</p>
          </div>
        </div>

        <SidebarNav expanded onNavigate={() => onOpenChange(false)} />

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
              {user?.full_name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {user?.full_name}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">{user?.role_display}</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
