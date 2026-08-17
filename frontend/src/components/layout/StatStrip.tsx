import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'positive' | 'warning' | 'danger'

export interface Stat {
  label: string
  value: ReactNode
  help?: string
  tone?: StatTone
  onClick?: () => void
  active?: boolean
}

const TONES: Record<StatTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-status-available',
  warning: 'text-status-cleaning',
  danger: 'text-status-occupied',
}

export function StatStrip({ stats, isLoading }: { stats: Stat[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.25rem] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const content = (
          <div className="px-4 py-3.5">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p
              className={cn(
                'mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular',
                TONES[stat.tone ?? 'neutral'],
              )}
            >
              {stat.value}
            </p>
            {stat.help ? (
              <p className="mt-1 text-2xs text-muted-foreground">{stat.help}</p>
            ) : null}
          </div>
        )

        if (!stat.onClick) {
          return (
            <Card key={stat.label} className={cn(stat.active && 'ring-1 ring-foreground/10')}>
              {content}
            </Card>
          )
        }

        return (
          <Card
            key={stat.label}
            asChild
            className={cn(
              'cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md',
              'active:translate-y-0 active:scale-[0.99]',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
              stat.active && 'border-foreground/30 ring-1 ring-foreground/10',
            )}
          >
            <button type="button" onClick={stat.onClick} aria-pressed={stat.active} className="text-left">
              {content}
            </button>
          </Card>
        )
      })}
    </div>
  )
}
