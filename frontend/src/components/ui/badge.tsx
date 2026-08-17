import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border',
    'px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
    '[&>svg]:pointer-events-none [&>svg]:size-3',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        /* Estados: contorno tenue en vez de relleno saturado. */
        available: 'border-status-available/30 bg-status-available/10 text-status-available',
        occupied: 'border-status-occupied/30 bg-status-occupied/10 text-status-occupied',
        cleaning: 'border-status-cleaning/30 bg-status-cleaning/10 text-status-cleaning',
        maintenance:
          'border-status-maintenance/30 bg-status-maintenance/10 text-status-maintenance',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
