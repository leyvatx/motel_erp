import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { PiBed } from 'react-icons/pi'

import { SidebarNav } from '@/components/layout/SidebarNav'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useBrand } from '@/features/config/hooks'
import { nombreDelProducto } from '@/lib/brand'
import { useAuthStore } from '@/store/auth'
import { ImageWithFallback } from '@/components/ui/image'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
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
            <ImageWithFallback
              src={logoUrl}
              className="h-full w-full object-contain"
              fallback={<PiBed className="h-4 w-4 text-white" aria-hidden />}
            />
          </div>
          <div className="min-w-0 leading-tight">
            <SheetTitle className="truncate text-sm text-sidebar-accent-foreground">
              {businessName || nombreDelProducto()}
            </SheetTitle>
            <p className="truncate text-2xs text-sidebar-foreground/70">
              {t('comun.administracion')}
            </p>
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
