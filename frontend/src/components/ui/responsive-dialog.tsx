import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/**
 * Diálogo en escritorio, hoja inferior en el teléfono.
 *
 * Un modal centrado en una pantalla de teléfono deja los botones donde el
 * pulgar no llega, y el teclado virtual lo empuja fuera de cuadro al escribir.
 * La hoja sube desde abajo, se cierra arrastrando y deja las acciones en la
 * franja que la mano ya cubre.
 *
 * Las dos variantes usan el mismo primitivo de Radix por debajo -- foco
 * atrapado, cierre con Escape, marcado accesible -- así que lo único que
 * cambia es de dónde entra y dónde queda.
 */
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Ancho del diálogo en escritorio. En el teléfono no aplica: ocupa el ancho. */
  className?: string
  /** Cómo entra en escritorio.
   *
   *  `dialogo` es el centro de la pantalla, y es lo correcto cuando lo que se
   *  pide interrumpe: confirmar, decidir, cobrar. `panel` entra por el costado
   *  y deja ver lo que hay detrás, que es lo que hace falta cuando se está
   *  capturando algo *sobre* la pantalla de atrás -- dar de alta un producto
   *  sin perder de vista el catálogo y la cuenta a medio armar. */
  variante?: 'dialogo' | 'panel'
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  variante = 'dialogo',
}: Props) {
  const movil = useEsMovil()

  if (movil) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {/* El tirador no hace nada por sí solo: dice que la hoja se arrastra,
              que es lo que la gente intenta antes de buscar la X. */}
          <span
            className="mx-auto h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25"
            aria-hidden
          />
          <SheetHeader className="pr-12 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>

          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    )
  }

  if (variante === 'panel') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className={cn('w-full gap-4 p-5 sm:max-w-md', className)}>
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>

          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {children}

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
