import { useMemo, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { StatStrip } from '@/components/layout/StatStrip'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { AuditDetailDialog } from '@/features/audit/AuditDetailDialog'
import {
  exportAuditLogs,
  type AuditLog,
  type AuditParams,
  useAuditFilterOptions,
  useAuditLogs,
  useAuditSummary,
} from '@/features/audit/api'
import { apiErrorMessage } from '@/lib/axios'
import { formatDateTime } from '@/lib/format'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const actionTone: Record<string, BadgeVariant> = {
  CREATE: 'available',
  RESTORE: 'available',
  ROOM_RENTED: 'occupied',
  ROOM_CHECKOUT: 'available',
  ROOM_CANCELLED: 'destructive',
  ORDER_CANCELLED: 'destructive',
  PAYMENT_VOIDED: 'destructive',
  SOFT_DELETE: 'destructive',
  STOCK_MOVED: 'secondary',
}

export default function AuditPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [module, setModule] = useState('all')
  const [actor, setActor] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const [exporting, setExporting] = useState(false)

  const target = searchParams.get('target') || undefined
  const objectIdParam = searchParams.get('object_id')
  const objectId = objectIdParam ? Number(objectIdParam) : undefined
  const filters = useAuditFilterOptions()
  const queryParams = useMemo<AuditParams>(
    () => ({
      page,
      page_size: pageSize,
      search: search || undefined,
      action: action === 'all' ? undefined : action,
      module: module === 'all' ? undefined : module,
      actor: actor === 'all' ? undefined : Number(actor),
      from: from || undefined,
      to: to || undefined,
      target,
      object_id: Number.isFinite(objectId) ? objectId : undefined,
    }),
    [action, actor, from, module, objectId, page, pageSize, search, target, to],
  )
  const logs = useAuditLogs(queryParams)
  const summaryParams = { ...queryParams, page: undefined, page_size: undefined }
  const summary = useAuditSummary(summaryParams)
  const totalSummary = (summary.data ?? []).reduce((total, item) => total + item.total, 0)
  const topActions = (summary.data ?? []).slice(0, 3)

  const resetFilters = () => {
    setSearch('')
    setAction('all')
    setModule('all')
    setActor('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const download = async () => {
    setExporting(true)
    try {
      const blob = await exportAuditLogs(summaryParams)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Auditoría exportada', `${totalSummary} registros incluidos.`)
    } catch (error) {
      toast.error('No se pudo exportar', apiErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageShell
      title="Auditoría"
      description="Consulta quién hizo cada cambio y cuándo ocurrió."
      actions={
        <Button variant="outline" onClick={download} loading={exporting} disabled={!totalSummary}>
          <Download />
          Exportar CSV
        </Button>
      }
      toolbar={
        <div className="space-y-3">
          <StatStrip
            isLoading={summary.isLoading}
            stats={[
              { label: 'Operaciones', value: totalSummary, help: 'Con los filtros actuales' },
              ...topActions.map((item) => ({ label: item.action_display, value: item.total })),
              ...Array.from({ length: Math.max(0, 3 - topActions.length) }, (_, index) => ({
                label: `Sin actividad ${index + 1}`,
                value: 0,
              })),
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-64 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar descripción, objeto o usuario"
                className="pl-9"
              />
            </div>
            <Select
              value={module}
              onValueChange={(value) => {
                setModule(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los módulos</SelectItem>
                {(filters.data?.modules ?? []).map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {(filters.data?.actions ?? []).map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actor}
              onValueChange={(value) => {
                setActor(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {(filters.data?.actors ?? []).map((item) => (
                  <SelectItem key={item.value} value={String(item.value)}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="Fecha inicial"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="Fecha final"
            />
            <Button variant="ghost" size="icon" onClick={resetFilters} title="Limpiar filtros">
              <RotateCcw />
            </Button>
          </div>
          {target ? (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">
                Historial de {target}
                {objectId ? ` #${objectId}` : ''}
              </Badge>
              <span className="text-muted-foreground">
                Abre Auditoría desde el menú para volver a todos los registros.
              </span>
            </div>
          ) : null}
        </div>
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Objeto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.isLoading ? (
                Array.from({ length: 8 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.data?.results.length ? (
                logs.data.results.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(log)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {log.actor_name || log.actor_username || 'Sistema'}
                      </div>
                      {log.actor_name && log.actor_username ? (
                        <div className="text-xs text-muted-foreground">@{log.actor_username}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionTone[log.action] ?? 'outline'}>
                        {log.action_display}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.module_display}</TableCell>
                    <TableCell className="max-w-sm">
                      <p className="line-clamp-2">{log.description || 'Sin descripción'}</p>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {log.object_repr || '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={6} message="No hay operaciones con estos filtros." />
              )}
            </TableBody>
          </Table>
        </TableScroll>
        {logs.data ? (
          <Pagination
            page={logs.data.page}
            pageSize={logs.data.page_size}
            count={logs.data.count}
            totalPages={logs.data.total_pages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            isFetching={logs.isFetching}
          />
        ) : null}
      </Card>
      <AuditDetailDialog
        log={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </PageShell>
  )
}
