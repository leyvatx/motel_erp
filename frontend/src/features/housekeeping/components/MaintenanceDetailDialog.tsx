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
import { useMaintenanceReport } from '@/features/housekeeping/hooks'
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
  const { t } = useTranslation()
  // El renglón de la lista abre el diálogo de inmediato -- título, folio,
  // prioridad -- y la ficha completa lo rellena al llegar. Antes se recorría
  // `report.updates` directamente y la lista nunca lo trae: abrir un reporte
  // desde la tabla reventaba la pantalla.
  const detalle = useMaintenanceReport(report?.id ?? null)
  const ficha = detalle.data ?? report

  if (!report || !ficha) return null

  const seguimiento = ficha.updates ?? []

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {ficha.title}
            <Badge variant={PRIORITY_VARIANT[ficha.priority] ?? 'secondary'}>
              {ficha.priority_display}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {ficha.folio} ·{' '}
            {ficha.room_number
              ? `Habitación ${ficha.room_number}`
              : ficha.area || t('limpieza.areaComun')}
          </DialogDescription>
        </DialogHeader>

        {ficha.description ? (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{ficha.description}</p>
        ) : null}

        {/* La foto de quien reportó. Abre en pestaña propia porque en el
            diálogo se ve pequeña y lo que se necesita es el detalle de la
            avería. */}
        {ficha.photo_url ? (
          <a
            href={ficha.photo_url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <img
              src={ficha.photo_url}
              alt={`Foto del reporte ${ficha.folio}`}
              className="max-h-56 w-full object-cover"
            />
          </a>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label={t('limpieza.estado')} value={ficha.status_display} />
          <Field label={t('limpieza.categoria')} value={ficha.category_display} />
          <Field label={t('limpieza.reporto')} value={ficha.reported_by_name} />
          <Field
            label={t('limpieza.asignadoA')}
            value={ficha.assigned_to_name ?? t('limpieza.sinAsignar')}
          />
          <Field label={t('limpieza.levantado')} value={formatDateTime(ficha.created_at)} />
          <Field
            label={t('limpieza.cuartoFueraDeServicio')}
            value={ficha.blocks_room ? 'Sí' : 'No'}
          />
          {ficha.resolved_at ? (
            <>
              <Field label={t('limpieza.resuelto')} value={formatDateTime(ficha.resolved_at)} />
              <Field label={t('limpieza.costo')} value={formatMoney(ficha.cost)} />
            </>
          ) : null}
        </dl>

        {ficha.resolution_notes ? (
          <p className="rounded-md border border-status-available/30 bg-status-available/5 px-3 py-2 text-sm">
            {ficha.resolution_notes}
          </p>
        ) : null}

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('limpieza.seguimiento')}
          </p>
          {detalle.isLoading && seguimiento.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('limpieza.cargandoHistorial')}</p>
          ) : null}
          <ol className="space-y-3">
            {seguimiento.map((update) => (
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
