import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useCurrentUser } from '@/features/auth/hooks'
import { useRealtime } from '@/hooks/useRealtime'
import { unlockAudio } from '@/lib/sound'

/**
 * Armazón de la aplicación.
 *
 * Monta el WebSocket una sola vez para toda la sesión y revalida el perfil
 * contra el servidor por si el rol del empleado cambió desde el último acceso.
 */
export function AppLayout() {
  const { state } = useRealtime()
  useCurrentUser()

  // Los navegadores exigen un gesto del usuario antes de reproducir audio.
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar connection={state} />

        {/* La página nunca se desplaza: cada sección administra su propio
            scroll interno para que encabezados y paginación queden a la vista.
            Sin ancho máximo, porque dejar franjas vacías a los lados
            desperdicia cuartos visibles del grid. */}
        <main className="min-h-0 flex-1 overflow-hidden bg-muted/40">
          <div className="h-full w-full p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
