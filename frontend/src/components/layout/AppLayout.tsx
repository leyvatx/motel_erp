import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { MobileNav } from '@/components/layout/MobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { sectionTitle } from '@/components/layout/navigation'
import { useCurrentUser } from '@/features/auth/hooks'
import { OpenShiftDialog } from '@/features/finances/components/OpenShiftDialog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRealtime } from '@/hooks/useRealtime'
import { unlockAudio } from '@/lib/sound'

export function AppLayout() {
  const { state } = useRealtime()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useCurrentUser()

  useDocumentTitle(sectionTitle(pathname))

  useEffect(() => {
    const handler = (): void => unlockAudio()
    window.addEventListener('pointerdown', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  return (
    <div className="flex h-[100svh] overflow-hidden bg-background">
      <Sidebar />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar connection={state} onOpenMenu={() => setMenuOpen(true)} />

        <main className="min-h-0 flex-1 overflow-hidden bg-muted/40">
          <div className="h-full w-full p-3 sm:p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <OpenShiftDialog />
    </div>
  )
}
