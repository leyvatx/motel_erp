import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PiCheck,
  PiCheckCircle,
  PiClipboardText,
  PiPlay,
  PiSparkle,
  PiWarning,
} from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/states'
import { ReportMaintenanceDialog } from '@/features/housekeeping/components/ReportMaintenanceDialog'
import { useFinishCleaningTask, useStartCleaning } from '@/features/housekeeping/hooks'
import type { CleaningTask } from '@/features/housekeeping/types'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/** El tiempo que lleva la tarea, en palabras. */
function tiempo(task: CleaningTask): string {
  return task.started_at
    ? `Empezó ${formatRelative(task.started_at)}`
    : `Esperando desde ${formatRelative(task.created_at)}`
}

interface Props {
  tasks: CleaningTask[]
  isLoading: boolean
  isError?: boolean
  /** Sin red: no es "no hay tareas", es "todavía no sabemos". */
  sinConexion?: boolean
  onRetry?: () => void
  /** Cuántas tareas hay en total cuando la lista está filtrada a las propias. */
  sinAsignar?: number
  onVerTodas?: () => void
}

/**
 * La cola de limpieza como la usa quien limpia: una tarjeta por habitación, la
 * siguiente arriba, y una sola acción grande.
 *
 * Está diseñada para el teléfono primero, no adaptada desde la tabla. Quien
 * trabaja aquí lo hace de pie, con una mano, a veces con guantes: no puede
 * apuntar a un renglón de tabla ni encontrar un menú de tres puntos. Por eso
 * cada tarjeta tiene exactamente dos salidas -- terminé, o hay un problema --
 * con área de toque de 56 px, muy por encima del mínimo de 44.
 *
 * Al terminar una, la tarjeta desaparece de la lista y la siguiente sube sola:
 * nadie tiene que volver a buscar dónde iba.
 */
export function CleaningQueue({
  tasks,
  isLoading,
  isError = false,
  sinConexion = false,
  onRetry,
  sinAsignar = 0,
  onVerTodas,
}: Props) {
  const { t } = useTranslation()
  const start = useStartCleaning()
  const finish = useFinishCleaningTask()

  const [cerrando, setCerrando] = useState<CleaningTask | null>(null)
  const [notas, setNotas] = useState('')
  const [reportando, setReportando] = useState<CleaningTask | null>(null)

  // "No pudimos cargar" y "no hay nada que limpiar" se ven igual si los dos
  // son una lista vacía, y para quien empieza su turno son opuestos: uno
  // significa descansa, el otro significa reintenta.
  if (isError) {
    return (
      <ErrorState
        title={t('limpieza.noPudimosTusTareas')}
        description={t('limpieza.listaNoLlego')}
        onRetry={onRetry}
      />
    )
  }

  if (sinConexion) {
    return <OfflineState descripcion={t('limpieza.sinRed')} />
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    // Dos vacíos distintos: "ya no hay trabajo" y "el trabajo no es tuyo
    // todavía". El segundo necesita un botón, no una felicitación.
    if (sinAsignar > 0) {
      return (
        <EmptyState
          title={t('limpieza.sinTareasAsignadas')}
          description={`Hay ${sinAsignar} ${
            sinAsignar === 1 ? t('limpieza.habitacionPendiente') : 'habitaciones pendientes'
          } que nadie ha tomado.`}
          icon={<PiClipboardText className="h-8 w-8" aria-hidden />}
          action={
            onVerTodas ? (
              <Button className="h-11" onClick={onVerTodas}>
                {t('limpieza.verTodasPendientes')}
              </Button>
            ) : null
          }
        />
      )
    }

    return (
      <EmptyState
        title={t('limpieza.nadaPendiente')}
        description={t('limpieza.todasLimpias')}
        icon={<PiSparkle className="h-8 w-8" aria-hidden />}
      />
    )
  }

  return (
    <>
      <ul className="space-y-2.5 pb-2">
        {tasks.map((task, indice) => {
          const enProceso = task.status === 'IN_PROGRESS'
          const siguiente = indice === 0 && !enProceso

          return (
            <li
              key={task.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-card',
                enProceso && 'border-status-cleaning/50 bg-status-cleaning/[0.04]',
                siguiente && 'border-foreground/20',
              )}
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-mono text-3xl font-medium leading-none tracking-tightest">
                    {task.room_number}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{task.task_type_display}</p>
                </div>

                <div className="shrink-0 text-right">
                  {enProceso ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-status-cleaning/15 px-2.5 py-1 text-2xs font-medium text-status-cleaning">
                      <span
                        className="h-1.5 w-1.5 animate-pulse-alert rounded-full bg-status-cleaning"
                        aria-hidden
                      />
                      {t('limpieza.limpiando')}
                    </span>
                  ) : siguiente ? (
                    <span className="rounded-full border px-2.5 py-1 text-2xs font-medium">
                      {t('limpieza.sigueEsta')}
                    </span>
                  ) : null}
                  <p className="mt-1.5 text-2xs text-muted-foreground">{tiempo(task)}</p>
                </div>
              </div>

              {task.assigned_to_name ? (
                <p className="px-4 pb-2 text-xs text-muted-foreground">
                  Asignada a {task.assigned_to_name}
                </p>
              ) : null}

              {/* Botones de 56 px de alto y ancho completo: el pulgar cae aquí
                  sin apuntar, que es lo único que se puede pedir con guantes. */}
              <div className="grid grid-cols-2 gap-px border-t bg-border">
                {enProceso ? (
                  <Button
                    variant="ghost"
                    className="h-14 rounded-none bg-card text-base font-medium text-status-available hover:bg-status-available/10"
                    loading={finish.isPending && cerrando?.id === task.id}
                    onClick={() => {
                      setNotas('')
                      setCerrando(task)
                    }}
                  >
                    <PiCheckCircle className="h-5 w-5" />
                    {t('limpieza.lista')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="h-14 rounded-none bg-card text-base font-medium hover:bg-accent"
                    loading={start.isPending}
                    onClick={() => start.mutate(task.id)}
                  >
                    <PiPlay className="h-5 w-5" />
                    {t('limpieza.empezar')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="h-14 rounded-none bg-card text-base font-medium text-status-cleaning hover:bg-status-cleaning/10"
                  onClick={() => setReportando(task)}
                >
                  <PiWarning className="h-5 w-5" />
                  {t('limpieza.problema')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Cierre de la tarea: una nota opcional y confirmar. La barra se queda
          pegada al borde inferior, sobre el área segura del teléfono, porque
          ahí es donde la mano ya está. */}
      {cerrando ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Habitación {cerrando.room_number} lista</p>
              <Input
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                placeholder={t('limpieza.algoQueAnotar')}
                className="mt-2 h-11"
                aria-label={t('limpieza.observacionesLimpieza')}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1 sm:flex-none"
                onClick={() => setCerrando(null)}
              >
                {t('limpieza.cancelar')}
              </Button>
              <Button
                variant="success"
                className="h-12 flex-1 text-base sm:flex-none"
                loading={finish.isPending}
                onClick={() =>
                  finish.mutate(
                    { taskId: cerrando.id, notes: notas, foundIssues: false },
                    { onSuccess: () => setCerrando(null) },
                  )
                }
              >
                <PiCheck className="h-5 w-5" />
                {t('limpieza.confirmar')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ReportMaintenanceDialog
        open={reportando !== null}
        onOpenChange={(abierto) => !abierto && setReportando(null)}
        defaultRoomId={reportando?.room ?? null}
      />
    </>
  )
}
