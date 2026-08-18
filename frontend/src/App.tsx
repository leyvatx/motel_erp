import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { BrandSync } from '@/components/BrandSync'
import { ContextMenuHost } from '@/components/ui/row-actions'
import { Toaster } from '@/components/ui/toast'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandSync />
      <RouterProvider router={router} />
      <ContextMenuHost />
      <Toaster />
    </QueryClientProvider>
  )
}
