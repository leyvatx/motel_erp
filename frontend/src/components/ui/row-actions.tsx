import { useEffect, type ReactNode } from 'react'
import { PiDotsThreeVertical } from 'react-icons/pi'
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
              item.danger && 'text-destructive focus:bg-destructive/10 focus:text-destructive',
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
          <PiDotsThreeVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <ActionItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ContextMenuHost() {
  const { open, x, y, title, items, hide } = useContextMenuStore()

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
