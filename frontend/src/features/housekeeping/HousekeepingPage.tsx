import { useState } from 'react'
import { PiCheckCircle, PiEye, PiPlay, PiUserCheck, PiWrench } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { ModuleHelp } from '@/components/layout/ModuleHelp'
import { ErrorState, OfflineState, estadoDeConsulta } from '@/components/ui/states'
import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { StatStrip } from '@/components/layout/StatStrip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RowActions, useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { CleaningQueue } from '@/features/housekeeping/components/CleaningQueue'
import { MaintenanceDetailDialog } from '@/features/housekeeping/components/MaintenanceDetailDialog'
import { ReportMaintenanceDialog } from '@/features/housekeeping/components/ReportMaintenanceDialog'
import {
  useCleaningBoard,
  useCleaningPerformance,
  useFinishCleaningTask,
  useMaintenanceReports,
  useMaintenanceTransition,
  useStartCleaning,
} from '@/features/housekeeping/hooks'
import type { CleaningTask, MaintenanceReport } from '@/features/housekeeping/types'
import { formatDateTime, formatDuration, formatMoney, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const TASK_VARIANT: Record<string, 'secondary' | 'cleaning' | 'available'> = {
  PENDING: 'secondary',
  ASSIGNED: 'secondary',
  IN_PROGRESS: 'cleaning',
  DONE: 'available',
  VERIFIED: 'available',
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-brand-accent',
  HIGH: 'text-status-cleaning',
  URGENT: 'text-status-occupied font-medium',
}

export default function HousekeepingPage() {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.user?.role)
  const esMovil = useEsMovil()
  const [mine, setMine] = useState(role === 'HOUSEKEEPING')
  const [reporting, setReporting] = useState(false)
  const [detail, setDetail] = useState<MaintenanceReport | null>(null)
  const [closing, setClosing] = useState<CleaningTask | null>(null)
  const [notes, setNotes] = useState('')

  const board = useCleaningBoard(mine)
  // Con el filtro "solo las mías" puesto, una lista vacía no significa que no
  // haya trabajo: puede significar que nadie le ha asignado nada. Decirle
  // "todas las habitaciones están limpias" a alguien que empieza su turno con
  // cuartos sucios sin asignar es mentirle con confianza. Esta consulta solo
  // sale cuando hace falta desempatar, y comparte caché con el botón "Ver
  // todas", así que tocarlo no cuesta otra llamada.
  const sinFiltrar = useCleaningBoard(false, mine)
  const maintenance = useMaintenanceReports()
  const performance = useCleaningPerformance()
  const start = useStartCleaning()
  const finish = useFinishCleaningTask()
  const openContextMenu = useRowContextMenu()

  const estadoBoard = estadoDeConsulta(board)
  const tasks = board.data?.results ?? []

  /** Quién ve la cola de tarjetas en vez de la tabla.
   *
   *  Ama de llaves siempre: es su trabajo, y una tabla de seis columnas con
   *  menús de tres puntos no se opera de pie. Supervisión y gerencia ven la
   *  tabla en escritorio -- ahí sí sirve comparar tiempos y responsables -- y
   *  la misma cola en el teléfono, donde la tabla obligaría a hacer zoom. */
  const colaTactil = role === 'HOUSEKEEPING' || esMovil
  const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length
  const reports = maintenance.data?.results ?? []
  const openReports = reports.filter((report) =>
    ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(report.status),
  ).length
  const urgent = reports.filter(
    (report) => report.priority === 'URGENT' && report.status !== 'RESOLVED',
  ).length

  const taskActions = (task: CleaningTask): RowAction[] => [
    {
      key: 'start',
      label: t('limpieza.iniciarLimpieza'),
      icon: <PiPlay />,
      disabled: task.status === 'IN_PROGRESS',
      onSelect: () => start.mutate(task.id),
    },
    {
      key: 'finish',
      label: t('limpieza.terminarYLiberarCuartoDos'),
      icon: <PiCheckCircle />,
      disabled: task.status !== 'IN_PROGRESS',
      onSelect: () => {
        setNotes('')
        setClosing(task)
      },
    },
  ]

  return (
    <PageShell
      title={t('limpieza.titulo')}
      description={t('limpieza.subtitulo')}
      actions={
        <>
          <ModuleHelp modulo="limpieza" />
          <Button
            variant="outline"
            className="h-11 sm:h-9"
            size="sm"
            onClick={() => setMine(!mine)}
          >
            <PiUserCheck />
            {mine ? t('limpieza.verTodas') : t('limpieza.soloLasMias')}
          </Button>
          <Button className="h-11 sm:h-9" size="sm" onClick={() => setReporting(true)}>
            <PiWrench />
            {t('limpieza.reportarProblema')}
          </Button>
        </>
      }
      toolbar={
        <StatStrip
          isLoading={board.isLoading || estadoBoard === 'sin-conexion'}
          stats={[
            {
              label: t('limpieza.cuartosPorLimpiar'),
              value: tasks.length,
              help: t('limpieza.cuartosPendientes'),
            },
            {
              label: t('limpieza.enProceso'),
              value: inProgress,
              tone: inProgress > 0 ? 'warning' : 'neutral',
              help: t('limpieza.conCronometro'),
            },
            {
              label: t('limpieza.mantenimientoAbierto'),
              value: openReports,
              tone: openReports > 0 ? 'warning' : 'positive',
              help: t('limpieza.reportesSinResolver'),
            },
            {
              label: t('limpieza.urgentes'),
              value: urgent,
              tone: urgent > 0 ? 'danger' : 'positive',
              help: t('limpieza.requierenAtencion'),
            },
          ]}
        />
      }
    >
      <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="board">{t('limpieza.limpieza')}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('limpieza.mantenimiento')}</TabsTrigger>
          <TabsTrigger value="performance">{t('limpieza.rendimiento')}</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="flex min-h-0 flex-1 flex-col">
          {colaTactil ? (
            <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
              <CleaningQueue
                tasks={tasks}
                isLoading={board.isLoading}
                isError={board.isError}
                sinConexion={estadoBoard === 'sin-conexion'}
                onRetry={() => void board.refetch()}
                sinAsignar={mine ? (sinFiltrar.data?.results.length ?? 0) : 0}
                onVerTodas={() => setMine(false)}
              />
            </div>
          ) : (
            <Card className="min-h-0 flex-1">
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                {estadoBoard === 'sin-conexion' ? (
                  <OfflineState descripcion={t('limpieza.sinRedTablero')} />
                ) : estadoBoard === 'error' ? (
                  <ErrorState
                    title={t('limpieza.noPudimosTablero')}
                    description={t('limpieza.tareasNoLlegaron')}
                    onRetry={() => void board.refetch()}
                    retrying={board.isFetching}
                  />
                ) : (
                  <TableScroll>
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>{t('limpieza.habitacion')}</TableHead>
                          <TableHead>{t('limpieza.tipo')}</TableHead>
                          <TableHead>{t('limpieza.asignadaA')}</TableHead>
                          <TableHead>{t('limpieza.estado')}</TableHead>
                          <TableHead>{t('limpieza.tiempo')}</TableHead>
                          <TableHead className="w-[52px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.length === 0 ? (
                          <TableEmpty colSpan={6} message={t('limpieza.nadaPendienteDetalle')} />
                        ) : (
                          tasks.map((task) => (
                            <TableRow
                              key={task.id}
                              onContextMenu={openContextMenu(
                                t('limpieza.habitacionNumero', { numero: task.room_number }),
                                taskActions(task),
                              )}
                              className={cn(
                                'cursor-context-menu',
                                task.status === 'IN_PROGRESS' && 'bg-status-cleaning/5',
                              )}
                            >
                              <TableCell className="font-medium tabular">
                                {task.room_number}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {task.task_type_display}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {task.assigned_to_name ?? t('limpieza.sinAsignar')}
                              </TableCell>
                              <TableCell>
                                <Badge variant={TASK_VARIANT[task.status] ?? 'secondary'}>
                                  {task.status_display}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {task.started_at
                                  ? t('limpieza.inicioHace', {
                                      tiempo: formatRelative(task.started_at),
                                    })
                                  : t('limpieza.enEsperaDesde', {
                                      tiempo: formatRelative(task.created_at),
                                    })}
                              </TableCell>
                              <TableCell className="text-right">
                                <RowActions
                                  items={taskActions(task)}
                                  label={t('limpieza.habitacionNumero', {
                                    numero: task.room_number,
                                  })}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableScroll>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="flex min-h-0 flex-1 flex-col">
          <Card className="min-h-0 flex-1">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>{t('limpieza.folio')}</TableHead>
                      <TableHead>{t('limpieza.falla')}</TableHead>
                      <TableHead>{t('limpieza.prioridad')}</TableHead>
                      <TableHead>{t('limpieza.estado')}</TableHead>
                      <TableHead className="text-right">{t('limpieza.costo')}</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableEmpty colSpan={6} message={t('limpieza.ningunProblema')} />
                    ) : (
                      reports.map((report) => (
                        <MaintenanceRow
                          key={report.id}
                          report={report}
                          onDetail={() => setDetail(report)}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="flex min-h-0 flex-1 flex-col">
          <Card className="min-h-0 flex-1">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>{t('limpieza.empleado')}</TableHead>
                      <TableHead className="text-right">{t('limpieza.tareas')}</TableHead>
                      <TableHead className="text-right">{t('limpieza.promedio')}</TableHead>
                      <TableHead className="text-right">{t('limpieza.total')}</TableHead>
                      <TableHead className="text-right">{t('limpieza.conIncidencias')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(performance.data ?? []).length === 0 ? (
                      <TableEmpty colSpan={5} message={t('limpieza.sinCierres')} />
                    ) : (
                      (performance.data ?? []).map((row) => (
                        <TableRow key={row.employee_id ?? 'sin-asignar'}>
                          <TableCell className="font-medium">
                            {row.employee ?? t('limpieza.sinAsignar')}
                          </TableCell>
                          <TableCell className="text-right tabular">{row.tasks}</TableCell>
                          <TableCell className="text-right tabular">
                            {formatDuration(row.average_seconds)}
                          </TableCell>
                          <TableCell className="text-right tabular text-muted-foreground">
                            {formatDuration(row.total_seconds)}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {row.issues_reported}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {closing ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 shadow-lg">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {t('limpieza.terminarLimpiezaDe', { numero: closing.room_number })}
            </span>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('limpieza.observacionesOpcional')}
              className="max-w-sm flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => setClosing(null)}>
              {t('limpieza.cancelar')}
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={finish.isPending}
              onClick={() =>
                finish.mutate(
                  { taskId: closing.id, notes, foundIssues: false },
                  { onSuccess: () => setClosing(null) },
                )
              }
            >
              <PiCheckCircle />
              {t('limpieza.terminarYLiberar')}
            </Button>
          </div>
        </div>
      ) : null}

      <ReportMaintenanceDialog open={reporting} onOpenChange={setReporting} />
      <MaintenanceDetailDialog report={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </PageShell>
  )
}

function MaintenanceRow({ report, onDetail }: { report: MaintenanceReport; onDetail: () => void }) {
  const { t } = useTranslation()
  const transition = useMaintenanceTransition(report.id)
  const openContextMenu = useRowContextMenu()

  const actions: RowAction[] = [
    { key: 'detail', label: t('limpieza.verDetalles'), icon: <PiEye />, onSelect: onDetail },
    {
      key: 'attend',
      label: t('limpieza.marcarEnAtencionDos'),
      icon: <PiWrench />,
      separated: true,
      disabled: !['REPORTED', 'ACKNOWLEDGED'].includes(report.status),
      onSelect: () =>
        transition.mutate({ new_status: 'IN_PROGRESS', note: t('limpieza.seComenzoLaReparacion') }),
    },
    {
      key: 'resolve',
      label: t('limpieza.marcarResuelto'),
      icon: <PiCheckCircle />,
      disabled: report.status !== 'IN_PROGRESS',
      onSelect: () =>
        transition.mutate({ new_status: 'RESOLVED', note: t('limpieza.reparacionTerminada') }),
    },
  ]

  return (
    <TableRow
      onClick={onDetail}
      onContextMenu={openContextMenu(report.folio, actions)}
      className="cursor-pointer"
    >
      <TableCell className="font-mono text-xs">{report.folio}</TableCell>
      <TableCell>
        <p className="font-medium">{report.title}</p>
        <p className="text-2xs text-muted-foreground">
          {report.room_number
            ? t('limpieza.habitacionNumero', { numero: report.room_number })
            : report.area || t('limpieza.areaComun')}{' '}
          · {formatDateTime(report.created_at)}
        </p>
      </TableCell>
      <TableCell>
        <span className={cn('text-xs', PRIORITY_STYLES[report.priority])}>
          {report.priority_display}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{report.status_display}</TableCell>
      <TableCell className="text-right tabular">{formatMoney(report.cost)}</TableCell>
      <TableCell className="text-right">
        <RowActions items={actions} label={report.folio} />
      </TableCell>
    </TableRow>
  )
}
