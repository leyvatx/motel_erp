import { useState } from 'react'
import { CheckCircle2, Eye, Play, UserCheck, Wrench } from 'lucide-react'

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
  const role = useAuthStore((state) => state.user?.role)
  const [mine, setMine] = useState(role === 'HOUSEKEEPING')
  const [reporting, setReporting] = useState(false)
  const [detail, setDetail] = useState<MaintenanceReport | null>(null)
  const [closing, setClosing] = useState<CleaningTask | null>(null)
  const [notes, setNotes] = useState('')

  const board = useCleaningBoard(mine)
  const maintenance = useMaintenanceReports()
  const performance = useCleaningPerformance()
  const start = useStartCleaning()
  const finish = useFinishCleaningTask()
  const openContextMenu = useRowContextMenu()

  const tasks = board.data?.results ?? []
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
      label: 'Iniciar limpieza',
      icon: <Play />,
      disabled: task.status === 'IN_PROGRESS',
      onSelect: () => start.mutate(task.id),
    },
    {
      key: 'finish',
      label: 'Terminar y liberar cuarto',
      icon: <CheckCircle2 />,
      disabled: task.status !== 'IN_PROGRESS',
      onSelect: () => {
        setNotes('')
        setClosing(task)
      },
    },
  ]

  return (
    <PageShell
      title="Ama de llaves"
      description="Tareas de limpieza y reportes de mantenimiento."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setMine(!mine)}>
            <UserCheck />
            {mine ? 'Ver todas' : 'Solo las mías'}
          </Button>
          <Button size="sm" onClick={() => setReporting(true)}>
            <Wrench />
            Reportar falla
          </Button>
        </>
      }
      toolbar={
        <StatStrip
          isLoading={board.isLoading}
          stats={[
            { label: 'Cuartos por limpiar', value: tasks.length, help: 'pendientes y asignados' },
            {
              label: 'En proceso',
              value: inProgress,
              tone: inProgress > 0 ? 'warning' : 'neutral',
              help: 'con cronómetro corriendo',
            },
            {
              label: 'Mantenimiento abierto',
              value: openReports,
              tone: openReports > 0 ? 'warning' : 'positive',
              help: 'reportes sin resolver',
            },
            {
              label: 'Urgentes',
              value: urgent,
              tone: urgent > 0 ? 'danger' : 'positive',
              help: 'requieren atención inmediata',
            },
          ]}
        />
      }
    >
      <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="board">Limpieza</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="flex min-h-0 flex-1 flex-col">
          <Card className="min-h-0 flex-1">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Habitación</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Asignada a</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tiempo</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableEmpty
                        colSpan={6}
                        message="No hay habitaciones pendientes de limpieza."
                      />
                    ) : (
                      tasks.map((task) => (
                        <TableRow
                          key={task.id}
                          onContextMenu={openContextMenu(
                            `Habitación ${task.room_number}`,
                            taskActions(task),
                          )}
                          className={cn(
                            'cursor-context-menu',
                            task.status === 'IN_PROGRESS' && 'bg-status-cleaning/5',
                          )}
                        >
                          <TableCell className="font-medium tabular">{task.room_number}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {task.task_type_display}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {task.assigned_to_name ?? 'Sin asignar'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={TASK_VARIANT[task.status] ?? 'secondary'}>
                              {task.status_display}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {task.started_at
                              ? `Inició ${formatRelative(task.started_at)}`
                              : `En espera ${formatRelative(task.created_at)}`}
                          </TableCell>
                          <TableCell className="text-right">
                            <RowActions
                              items={taskActions(task)}
                              label={`habitación ${task.room_number}`}
                            />
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

        <TabsContent value="maintenance" className="flex min-h-0 flex-1 flex-col">
          <Card className="min-h-0 flex-1">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <TableScroll>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Falla</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableEmpty colSpan={6} message="Sin reportes registrados." />
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
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Tareas</TableHead>
                      <TableHead className="text-right">Promedio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Con incidencias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(performance.data ?? []).length === 0 ? (
                      <TableEmpty colSpan={5} message="Aún no hay limpiezas terminadas." />
                    ) : (
                      (performance.data ?? []).map((row) => (
                        <TableRow key={row.employee_id ?? 'sin-asignar'}>
                          <TableCell className="font-medium">
                            {row.employee ?? 'Sin asignar'}
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
              Terminar limpieza de habitación {closing.room_number}
            </span>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones (opcional)"
              className="max-w-sm flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => setClosing(null)}>
              Cancelar
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
              <CheckCircle2 />
              Terminar y liberar
            </Button>
          </div>
        </div>
      ) : null}

      <ReportMaintenanceDialog open={reporting} onOpenChange={setReporting} />
      <MaintenanceDetailDialog report={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </PageShell>
  )
}

function MaintenanceRow({
  report,
  onDetail,
}: {
  report: MaintenanceReport
  onDetail: () => void
}) {
  const transition = useMaintenanceTransition(report.id)
  const openContextMenu = useRowContextMenu()

  const actions: RowAction[] = [
    { key: 'detail', label: 'Ver detalles', icon: <Eye />, onSelect: onDetail },
    {
      key: 'attend',
      label: 'Marcar en atención',
      icon: <Wrench />,
      separated: true,
      disabled: !['REPORTED', 'ACKNOWLEDGED'].includes(report.status),
      onSelect: () =>
        transition.mutate({ new_status: 'IN_PROGRESS', note: 'Se comenzó la reparación' }),
    },
    {
      key: 'resolve',
      label: 'Marcar resuelto',
      icon: <CheckCircle2 />,
      disabled: report.status !== 'IN_PROGRESS',
      onSelect: () => transition.mutate({ new_status: 'RESOLVED', note: 'Reparación terminada' }),
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
          {report.room_number ? `Habitación ${report.room_number}` : report.area || 'Área común'} ·{' '}
          {formatDateTime(report.created_at)}
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
