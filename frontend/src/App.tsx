import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { ContextMenuHost } from '@/components/ui/row-actions'
import { Toaster } from '@/components/ui/toast'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'
import { applyAppearance, useAppearanceStore } from '@/store/appearance'

export default function App() {
  const theme = useAppearanceStore((state) => state.theme)
  const accentId = useAppearanceStore((state) => state.accentId)

  useEffect(() => {
    applyAppearance(theme, accentId)

    // Con tema "sistema" hay que seguir al sistema operativo en vivo.
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => applyAppearance(theme, accentId)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme, accentId])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ContextMenuHost />
      <Toaster />
    </QueryClientProvider>
  )
}
