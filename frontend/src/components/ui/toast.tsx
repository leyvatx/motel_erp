import { useEffect } from 'react'
import { PiCheckCircle, PiInfo, PiWarning, PiX, PiXCircle } from 'react-icons/pi'
import { create } from 'zustand'

import { cn } from '@/lib/utils'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ durationMs = 5000, ...toast }) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { ...toast, id, durationMs }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'info' }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'warning' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'error', durationMs: 8000 }),
}

const ICONS = {
  info: PiInfo,
  success: PiCheckCircle,
  warning: PiWarning,
  error: PiXCircle,
} as const

const STYLES: Record<ToastVariant, string> = {
  info: 'border-brand-accent/40 bg-card',
  success: 'border-status-available/40 bg-card',
  warning: 'border-status-cleaning/50 bg-card',
  error: 'border-status-occupied/50 bg-card',
}

const ICON_COLORS: Record<ToastVariant, string> = {
  info: 'text-brand-accent',
  success: 'text-status-available',
  warning: 'text-status-cleaning',
  error: 'text-status-occupied',
}

function ToastCard({ item }: { item: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const Icon = ICONS[item.variant]

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), item.durationMs)
    return () => window.clearTimeout(timer)
  }, [dismiss, item.durationMs, item.id])

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-4',
        STYLES[item.variant],
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLORS[item.variant])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Cerrar aviso"
      >
        <PiX className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
