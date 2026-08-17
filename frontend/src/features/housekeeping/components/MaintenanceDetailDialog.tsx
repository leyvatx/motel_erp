import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { MaintenanceReport } from '@/features/housekeeping/types'
import { formatDateTime, formatMoney } from '@/lib/format'

const PRIORITY_VARIANT: Record<string, 'secondary' | 'available' | 'cleaning' | 'occupied'> = {
  LOW: 'secondary',
  MEDIUM: 'available',
  HIGH: 'cleaning',
  URGENT: 'occupied',
}

interface Props {
  report: MaintenanceReport | null
  onOpenChange: (open: boolean) => void
}

export function MaintenanceDetailDialog({ report, onOpenChange }: Props) {
  if (!report) return null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {report.title}
            <Badge variant={PRIORITY_VARIANT[report.priority] ?? 'secondary'}>
              {report.priority_display}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {report.folio} ·{' '}
            {report.room_number ? `Habitación ${report.room_number}` : report.area || 'Área común'}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{report.description}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Estado" value={report.status_display} />
          <Field label="Categoría" value={report.category_display} />
          <Field label="Reportó" value={report.reported_by_name} />
          <Field label="Asignado a" value={report.assigned_to_name ?? 'Sin asignar'} />
          <Field label="Levantado" value={formatDateTime(report.created_at)} />
          <Field
            label="Cuarto fuera de servicio"
            value={report.blocks_room ? 'Sí' : 'No'}
          />
          {report.resolved_at ? (
            <>
              <Field label="Resuelto" value={formatDateTime(report.resolved_at)} />
              <Field label="Costo" value={formatMoney(report.cost)} />
            </>
          ) : null}
        </dl>

        {report.resolution_notes ? (
          <p className="rounded-md border border-status-available/30 bg-status-available/5 px-3 py-2 text-sm">
            {report.resolution_notes}
          </p>
        ) : null}

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Seguimiento</p>
          <ol className="space-y-3">
            {report.updates.map((update) => (
              <li key={update.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{update.note}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {update.created_by_name ?? 'Sistema'} · {formatDateTime(update.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
