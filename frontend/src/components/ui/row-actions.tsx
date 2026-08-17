/**
 * Acciones por renglón.
 *
 * En lugar de sembrar botones en cada fila, cada registro expone un solo menú
 * con sus acciones, accesible de dos formas: el botón de tres puntos y el clic
 * derecho sobre la fila. La lista de acciones se define una vez y alimenta a
 * ambos, así no se desincronizan.
 */

import { useEffect, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { create } from 'zustand'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RowAction {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Traza una línea divisoria antes de esta acción. */
  separated?: boolean
}

interface ContextMenuState {
  open: boolean
  x: number
  y: number
  title: string
  items: RowAction[]
  show: (payload: { x: number; y: number; title?: string; items: RowAction[] }) => void
  hide: () => void
}

const useContextMenuStore = create<ContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  title: '',
  items: [],
  show: ({ x, y, title = '', items }) => set({ open: true, x, y, title, items }),
  hide: () => set({ open: false }),
}))

/**
 * Devuelve el manejador de clic derecho para una fila.
 *
 * ```tsx
 * <TableRow onContextMenu={openMenu('Habitación 101', acciones)}>
 * ```
 */
export function useRowContextMenu() {
  const show = useContextMenuStore((state) => state.show)

  return (title: string, items: RowAction[]) =>
    (event: React.MouseEvent): void => {
      if (items.length === 0) return
      event.preventDefault()
      show({ x: event.clientX, y: event.clientY, title, items })
    }
}

function ActionItems({ items, onDone }: { items: RowAction[]; onDone?: () => void }) {
  return (
    <>
      {items.map((item) => (
        <div key={item.key}>
          {item.separated ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            disabled={item.disabled}
            onSelect={() => {
              item.onSelect()
              onDone?.()
            }}
            className={cn(
              item.danger &&
                'text-destructive focus:bg-destructive/10 focus:text-destructive',
            )}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        </div>
      ))}
    </>
  )
}

/** Botón de tres puntos con el menú de acciones del renglón. */
export function RowActions({ items, label }: { items: RowAction[]; label: string }) {
  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          aria-label={`Acciones de ${label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <ActionItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Menú flotante anclado al cursor. Se monta una sola vez en la aplicación.
 *
 * Radix necesita un disparador con posición: se usa un punto invisible
 * colocado en las coordenadas del clic.
 */
export function ContextMenuHost() {
  const { open, x, y, title, items, hide } = useContextMenuStore()

  // Un cambio de scroll deja el menú flotando lejos de su fila.
  useEffect(() => {
    if (!open) return
    const close = (): void => hide()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, hide])

  return (
    <DropdownMenu open={open} onOpenChange={(next) => !next && hide()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed h-0 w-0"
          style={{ left: x, top: y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={2} className="w-52">
        {title ? (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <ActionItems items={items} onDone={hide} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
