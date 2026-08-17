import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  description?: string
  actions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

export function PageShell({ title, description, actions, toolbar, children, className }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={title} description={description} actions={actions} />
      {toolbar}
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
    </div>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">{children}</div>
}
