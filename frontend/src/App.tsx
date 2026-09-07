import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { BrandSync } from '@/components/BrandSync'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContextMenuHost } from '@/components/ui/row-actions'
import { Toaster } from '@/components/ui/toast'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandSync />
      {/* Fuera del router a propósito: cubre también lo que reviente antes de
          que una ruta llegue a montar, donde `errorElement` todavía no existe. */}
      <ErrorBoundary zona="app">
        <RouterProvider router={router} />
      </ErrorBoundary>
      <ContextMenuHost />
      <Toaster />
    </QueryClientProvider>
  )
}
