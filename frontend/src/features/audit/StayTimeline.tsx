import {
  PiBed,
  PiClock,
  PiCreditCard,
  PiDoorOpen,
  PiPackage,
  PiProhibit,
  PiReceipt,
  PiSealQuestion,
} from 'react-icons/pi'
import type { IconType } from 'react-icons'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditLogs, type AuditLog } from '@/features/audit/api'
import { formatDateTime, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'

const MARKS: Record<string, { icon: IconType; tone: string }> = {
  ROOM_RENTED: { icon: PiBed, tone: 'text-status-available' },
  ROOM_EXTENDED: { icon: PiClock, tone: 'text-status-cleaning' },
  ROOM_CHECKOUT: { icon: PiDoorOpen, tone: 'text-brand-accent' },
  ROOM_CANCELLED: { icon: PiProhibit, tone: 'text-status-occupied' },
  ROOM_STATUS: { icon: PiDoorOpen, tone: 'text-muted-foreground' },
  ORDER_CREATED: { icon: PiPackage, tone: 'text-brand-accent' },
  ORDER_CANCELLED: { icon: PiProhibit, tone: 'text-status-occupied' },
  PAYMENT_REGISTERED: { icon: PiCreditCard, tone: 'text-status-available' },
  FOLIO_CLOSED: { icon: PiReceipt, tone: 'text-brand-accent' },
}

function detailsOf(log: AuditLog): string[] {
  const extra = log.extra ?? {}
  const lines: string[] = []

  const room = extra['room']
  if (typeof room === 'string' && room) lines.push(`Habitación ${room}`)

  const plate = extra['vehicle_plate']
  if (typeof plate === 'string' && plate) lines.push(`Placas ${plate}`)

  const warehouse = extra['warehouse']
  if (typeof warehouse === 'string' && warehouse) lines.push(`Almacén ${warehouse}`)

  const method = extra['method']
  if (typeof method === 'string' && method) lines.push(`Pago ${method}`)

  const amount = extra['amount'] ?? extra['total']
  if (typeof amount === 'string') lines.push(formatMoney(amount))

  const reason = extra['reason']
  if (typeof reason === 'string' && reason) lines.push(`Motivo: ${reason}`)

  return lines
}

function itemsOf(log: AuditLog): { product: string; quantity: string; line_total?: string }[] {
  const items = log.extra?.['items']
  if (!Array.isArray(items)) return []
  return items as { product: string; quantity: string; line_total?: string }[]
}

interface Props {
  stayId: number
  folioId: number | null
}

export function StayTimeline({ stayId, folioId }: Props) {
  const user = useAuthStore((state) => state.user)
  const canViewAudit = canAccessSection(user, 'audit')
  const stayLogs = useAuditLogs(
    { target: 'rooms.stay', object_id: stayId, page_size: 50 },
    canViewAudit,
  )
  const folioLogs = useAuditLogs(
    { target: 'sales.folio', object_id: folioId ?? 0, page_size: 50 },
    canViewAudit && folioId !== null,
  )

  const isLoading = stayLogs.isLoading || folioLogs.isLoading

  const entries = [...(stayLogs.data?.results ?? []), ...(folioLogs.data?.results ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  if (!canViewAudit) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        El historial detallado está disponible para gerencia.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sin movimientos registrados todavía.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ol className="relative space-y-4 pl-6">
        <span className="absolute bottom-2 left-[7px] top-2 w-px bg-border" aria-hidden />

        {entries.map((log) => {
          const mark = MARKS[log.action] ?? { icon: PiSealQuestion, tone: 'text-muted-foreground' }
          const Icon = mark.icon
          const details = detailsOf(log)
          const items = itemsOf(log)

          return (
            <li key={`${log.module}-${log.id}`} className="relative">
              <span
                className={cn(
                  'absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background',
                  mark.tone,
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>

              <div className="rounded-lg border px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium">{log.description}</p>
                  <span className="text-2xs tabular text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>

                <p className="mt-0.5 text-2xs text-muted-foreground">
                  {log.actor_name ?? (log.actor_username || 'Sistema')}
                  {log.ip_address ? ` · ${log.ip_address}` : ''}
                </p>

                {details.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{details.join(' · ')}</p>
                ) : null}

                {items.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 border-t pt-1.5">
                    {items.map((item, index) => (
                      <li
                        key={`${item.product}-${index}`}
                        className="flex justify-between text-xs text-muted-foreground"
                      >
                        <span className="truncate">
                          {item.quantity} × {item.product}
                        </span>
                        {item.line_total ? (
                          <span className="tabular">{formatMoney(item.line_total)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link to={`/audit?target=rooms.stay&object_id=${stayId}`}>
          Ver historial completo en Auditoría
        </Link>
      </Button>
    </div>
  )
}
