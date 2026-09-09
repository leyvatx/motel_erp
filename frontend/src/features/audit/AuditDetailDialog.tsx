import { PiArrowRight, PiGlobe, PiMonitor, PiUserCircle } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
          <DialogTitle>
            {log.description || log.object_repr || t('comun.operacionRegistrada')}
          </DialogTitle>
          <DialogDescription>{formatDateTime(log.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <PiUserCircle className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('comun.realizadoPor')}</p>
              <p className="font-medium">
                {log.actor_name || log.actor_username || t('comun.procesoAutomatico')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <PiGlobe className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('comun.direccionIp')}</p>
              <p className="font-medium">{log.ip_address || t('comun.noRegistrada')}</p>
            </div>
          </div>
          {log.object_repr ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">{t('auditoria.objetoAfectado')}</p>
              <p className="font-medium">{log.object_repr}</p>
            </div>
          ) : null}
        </div>

        {changes.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('auditoria.cambiosRealizados')}</h3>
            {changes.map(([field, change]) => (
              <div key={field} className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{fieldName(field)}</p>
                <div className="grid items-start gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                    {readable(change.before)}
                  </pre>
                  <PiArrowRight className="mt-2 hidden size-4 text-muted-foreground sm:block" />
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
            <h3 className="text-sm font-semibold">{t('comun.informacionAdicional')}</h3>
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
              <PiMonitor className="size-4 shrink-0" />
              <span className="break-all">{log.user_agent}</span>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
