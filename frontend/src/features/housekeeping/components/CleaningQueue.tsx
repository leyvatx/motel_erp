import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PiCheckCircle, PiClipboardText, PiSparkle, PiWarning } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/states'
import { ReportMaintenanceDialog } from '@/features/housekeeping/components/ReportMaintenanceDialog'
import { useFinishCleaningTask, useStartCleaning } from '@/features/housekeeping/hooks'
import type { CleaningTask } from '@/features/housekeeping/types'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

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
 * siguiente arriba, y dos salidas.
 *
 * Está diseñada para el teléfono primero, no adaptada desde la tabla. Quien
 * trabaja aquí lo hace de pie, con una mano ocupada, a veces con guantes: no
 * puede apuntar a un renglón de tabla ni encontrar un menú de tres puntos. Por
 * eso el número de cuarto se lee a un brazo de distancia y cada tarjeta tiene
 * exactamente dos botones, uno debajo del otro, del ancho completo y de 56 px
 * de alto -- no hay a dónde fallar el toque.
 *
 * "Todo bien" cierra la habitación de un toque. Antes eran dos -- empezar y
 * luego terminar -- y el primero no le servía a quien limpia: le servía al
 * cronómetro. Si la tarea no está iniciada, se inicia y se cierra en la misma
 * acción; el reloj deja de ser algo que el usuario tiene que recordar.
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

  const [liberando, setLiberando] = useState<number | null>(null)
  const [reportando, setReportando] = useState<CleaningTask | null>(null)

  /** El tiempo que lleva la tarea, en palabras. */
  const tiempo = (task: CleaningTask): string =>
    task.started_at
      ? t('limpieza.empezoHace', { tiempo: formatRelative(task.started_at) })
      : t('limpieza.esperandoDesde', { tiempo: formatRelative(task.created_at) })

  /* Un toque, un cuarto liberado.
   *
   *  El backend no deja saltar de "pendiente" a "hecha" -- la limpieza tiene
   *  que haber empezado para poder terminar -- así que cuando no está iniciada
   *  se encadenan las dos llamadas. Es un detalle del modelo de datos, y quien
   *  está parado en el pasillo con el carrito no tiene por qué conocerlo. */
  const liberar = async (task: CleaningTask): Promise<void> => {
    setLiberando(task.id)
    try {
      if (task.status !== 'IN_PROGRESS') await start.mutateAsync(task.id)
      await finish.mutateAsync({ taskId: task.id, notes: '', foundIssues: false })
    } catch {
      // El error ya salió en su aviso; la tarjeta se queda para reintentar.
    } finally {
      setLiberando(null)
    }
  }

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
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 animate-pulse rounded-xl bg-muted" />
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
          description={t('limpieza.nadieLasHaTomado', {
            cuantas: sinAsignar,
            queCosa:
              sinAsignar === 1
                ? t('limpieza.habitacionPendiente')
                : t('limpieza.habitacionesPendientes'),
          })}
          icon={<PiClipboardText className="h-8 w-8" aria-hidden />}
          action={
            onVerTodas ? (
              <Button className="h-12" onClick={onVerTodas}>
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
      <ul className="space-y-3 pb-2">
        {tasks.map((task, indice) => {
          const enProceso = task.status === 'IN_PROGRESS'
          const siguiente = indice === 0 && !enProceso
          const ocupada = liberando === task.id

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
                  {/* El número, enorme y monoespaciado: identifica el cuarto
                      desde el pasillo, sin acercarse el teléfono a la cara. */}
                  <p className="font-mono text-5xl font-semibold leading-none tracking-tightest">
                    {task.room_number}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{task.task_type_display}</p>
                  {task.assigned_to_name ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('limpieza.asignadaAPersona', { persona: task.assigned_to_name })}
                    </p>
                  ) : null}
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

              {/* Dos botones, uno debajo del otro, del ancho entero y de 56 px:
                  el pulgar cae aquí sin apuntar, que es lo único que se puede
                  pedir con guantes puestos. Lado a lado medían la mitad y el
                  error de toque caía en el botón de junto, que es el peor de
                  los dos errores posibles: liberar cuando querías reportar. */}
              <div className="flex flex-col gap-px border-t bg-border">
                <Button
                  variant="ghost"
                  className="h-14 w-full rounded-none bg-card text-base font-medium text-status-available hover:bg-status-available/10"
                  loading={ocupada}
                  onClick={() => void liberar(task)}
                >
                  <PiCheckCircle className="h-5 w-5" />
                  <span className="flex flex-col items-start leading-tight">
                    {ocupada ? t('limpieza.liberando') : t('limpieza.todoBien')}
                    {ocupada ? null : (
                      <span className="text-2xs font-normal text-muted-foreground">
                        {t('limpieza.liberaLaHabitacion')}
                      </span>
                    )}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  className="h-14 w-full rounded-none bg-card text-base font-medium text-status-cleaning hover:bg-status-cleaning/10"
                  onClick={() => setReportando(task)}
                >
                  <PiWarning className="h-5 w-5" />
                  {t('limpieza.reportarProblema')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <ReportMaintenanceDialog
        open={reportando !== null}
        onOpenChange={(abierto) => !abierto && setReportando(null)}
        defaultRoomId={reportando?.room ?? null}
      />
    </>
  )
}
