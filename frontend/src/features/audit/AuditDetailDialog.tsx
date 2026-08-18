import { ArrowRight, Globe2, Monitor, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { AuditLog } from '@/features/audit/api'
import { formatDateTime } from '@/lib/format'

function readable(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Sin valor'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function fieldName(value: string): string {
  const label = value.replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function AuditDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AuditLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!log) return null
  const changes = Object.entries(log.changes ?? {})
  const extra = Object.entries(log.extra ?? {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline">{log.module_display}</Badge>
            <Badge variant="secondary">{log.action_display}</Badge>
          </div>
          <DialogTitle>{log.description || log.object_repr || 'Operación registrada'}</DialogTitle>
          <DialogDescription>{formatDateTime(log.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <UserRound className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Realizado por</p>
              <p className="font-medium">
                {log.actor_name || log.actor_username || 'Proceso automático'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Globe2 className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Dirección IP</p>
              <p className="font-medium">{log.ip_address || 'No registrada'}</p>
            </div>
          </div>
          {log.object_repr ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Objeto afectado</p>
              <p className="font-medium">{log.object_repr}</p>
            </div>
          ) : null}
        </div>

        {changes.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Cambios realizados</h3>
            {changes.map(([field, change]) => (
              <div key={field} className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{fieldName(field)}</p>
                <div className="grid items-start gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                    {readable(change.before)}
                  </pre>
                  <ArrowRight className="mt-2 hidden size-4 text-muted-foreground sm:block" />
                  <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-primary/5 p-2 text-xs">
                    {readable(change.after)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {extra.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Información adicional</h3>
            <div className="divide-y rounded-lg border">
              {extra.map(([key, value]) => (
                <div key={key} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[10rem_1fr]">
                  <span className="text-muted-foreground">{fieldName(key)}</span>
                  <span className="break-words font-medium">{readable(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {log.user_agent ? (
          <>
            <Separator />
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Monitor className="size-4 shrink-0" />
              <span className="break-all">{log.user_agent}</span>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
