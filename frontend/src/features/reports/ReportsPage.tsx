import { useState } from 'react'
import { PiDownloadSimple } from 'react-icons/pi'

import { PageShell } from '@/components/layout/PageShell'
import { StatStrip, type Stat } from '@/components/layout/StatStrip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import {
  exportReport,
  type HousekeepingReport,
  type OccupancyReport,
  type ProductsReport,
  type ReportKind,
  type ReportPeriod,
  type RevenueReport,
  type ShiftsReport,
  useReport,
} from '@/features/reports/api'
import { ReportBars } from '@/features/reports/ReportBars'
import { apiErrorMessage } from '@/lib/axios'
import { formatDuration, formatMoney, formatQuantity } from '@/lib/format'

const tabs: { value: ReportKind; label: string }[] = [
  { value: 'revenue', label: 'Ingresos' },
  { value: 'occupancy', label: 'Ocupación' },
  { value: 'products', label: 'Productos' },
  { value: 'shifts', label: 'Turnos' },
  { value: 'housekeeping', label: 'Limpieza' },
]

function dateInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function LoadingReport() {
  return (
    <div className="space-y-4">
      <StatStrip isLoading stats={[]} />
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

function RevenueView({ data }: { data: RevenueReport }) {
  const stats: Stat[] = [
    { label: 'Ingresos', value: formatMoney(data.summary.revenue), tone: 'positive' },
    { label: 'Gastos', value: formatMoney(data.summary.expenses), tone: 'warning' },
    { label: 'Neto', value: formatMoney(data.summary.net) },
    { label: 'Pagos', value: data.summary.payments },
  ]
  return (
    <>
      <StatStrip stats={stats} />
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por día</CardTitle>
          <CardDescription>Cobros aplicados durante el periodo</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportBars
            money
            rows={data.daily.map((row) => ({ label: row.date, value: Number(row.revenue) }))}
          />
        </CardContent>
      </Card>
    </>
  )
}

function OccupancyView({ data }: { data: OccupancyReport }) {
  return (
    <>
      <StatStrip
        stats={[
          { label: 'Ocupación estimada', value: `${data.summary.occupancy_rate}%` },
          { label: 'Rentas', value: data.summary.rentals },
          { label: 'Habitaciones', value: data.summary.rooms },
          { label: 'Estancia promedio', value: `${data.summary.average_minutes} min` },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Rentas por día</CardTitle>
          <CardDescription>Entradas registradas en el periodo</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportBars rows={data.daily.map((row) => ({ label: row.date, value: row.rentals }))} />
        </CardContent>
      </Card>
    </>
  )
}

function ProductsView({ data }: { data: ProductsReport }) {
  return (
    <>
      <StatStrip
        stats={[
          { label: 'Productos vendidos', value: data.summary.products },
          { label: 'Unidades', value: formatQuantity(data.summary.units) },
          { label: 'Ingreso', value: formatMoney(data.summary.revenue), tone: 'positive' },
          { label: 'Margen estimado', value: formatMoney(data.summary.margin) },
        ]}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead>Ingreso</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.products.length ? (
              data.products.map((row) => (
                <TableRow key={row.product_id}>
                  <TableCell>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.sku}</p>
                  </TableCell>
                  <TableCell>{formatQuantity(row.quantity)}</TableCell>
                  <TableCell>{formatMoney(row.revenue)}</TableCell>
                  <TableCell>{formatMoney(row.cost)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(row.margin)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={5} message="No hubo venta de productos." />
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

function ShiftsView({ data }: { data: ShiftsReport }) {
  return (
    <>
      <StatStrip
        stats={[
          { label: 'Ventas', value: formatMoney(data.summary.sales), tone: 'positive' },
          { label: 'Gastos', value: formatMoney(data.summary.expenses), tone: 'warning' },
          {
            label: 'Diferencia acumulada',
            value: formatMoney(data.summary.difference),
            tone: Number(data.summary.difference) < 0 ? 'danger' : 'neutral',
          },
          { label: 'Turnos', value: data.summary.shifts },
        ]}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Cajero</TableHead>
              <TableHead>Ventas</TableHead>
              <TableHead>Diferencia</TableHead>
              <TableHead>Folios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.shifts.length ? (
              data.shifts.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.business_date}</TableCell>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.cashier__full_name}</TableCell>
                  <TableCell>{formatMoney(row.sales)}</TableCell>
                  <TableCell className={Number(row.difference) < 0 ? 'text-destructive' : ''}>
                    {formatMoney(row.difference)}
                  </TableCell>
                  <TableCell>{row.folios_closed}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={6} message="No hay turnos en este periodo." />
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

function HousekeepingView({ data }: { data: HousekeepingReport }) {
  return (
    <>
      <StatStrip
        stats={[
          { label: 'Limpiezas', value: data.summary.tasks },
          { label: 'Tiempo promedio', value: formatDuration(data.summary.average_seconds) },
          {
            label: 'Incidencias',
            value: data.summary.issues,
            tone: data.summary.issues ? 'warning' : 'neutral',
          },
          {
            label: 'Mantenimientos',
            value: `${data.summary.maintenance_resolved}/${data.summary.maintenance}`,
            help: 'Resueltos / reportados',
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por colaborador</CardTitle>
          <CardDescription>Tareas terminadas durante el periodo</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportBars
            rows={data.employees.map((row) => ({
              label: row.name || 'Sin asignar',
              value: row.tasks,
            }))}
          />
        </CardContent>
      </Card>
    </>
  )
}

export default function ReportsPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 29)
  const [kind, setKind] = useState<ReportKind>('revenue')
  const [from, setFrom] = useState(dateInput(thirtyDaysAgo))
  const [to, setTo] = useState(dateInput(now))
  const [exporting, setExporting] = useState(false)
  const period: ReportPeriod = { from, to }
  const report = useReport(kind, period, Boolean(from && to && from <= to))

  const download = async () => {
    setExporting(true)
    try {
      const blob = await exportReport(kind, period)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte-${kind}-${from}-${to}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte exportado')
    } catch (error) {
      toast.error('No se pudo exportar', apiErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  let content = null
  if (report.isLoading) content = <LoadingReport />
  else if (report.isError)
    content = (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          No se pudo cargar el reporte.
        </CardContent>
      </Card>
    )
  else if (report.data) {
    if (kind === 'revenue') content = <RevenueView data={report.data as RevenueReport} />
    if (kind === 'occupancy') content = <OccupancyView data={report.data as OccupancyReport} />
    if (kind === 'products') content = <ProductsView data={report.data as ProductsReport} />
    if (kind === 'shifts') content = <ShiftsView data={report.data as ShiftsReport} />
    if (kind === 'housekeeping')
      content = <HousekeepingView data={report.data as HousekeepingReport} />
  }

  return (
    <PageShell
      title="Reportes"
      description="Indicadores gerenciales de este motel."
      actions={
        <Button variant="outline" onClick={download} loading={exporting} disabled={!report.data}>
          <PiDownloadSimple />
          Exportar CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
            <TabsList className="flex h-auto flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
              aria-label="Fecha inicial"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-40"
              aria-label="Fecha final"
            />
          </div>
        </div>
      }
      className="overflow-auto pb-2"
    >
      <div className="space-y-4">
        {from > to ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-destructive">
              La fecha inicial debe ser anterior a la fecha final.
            </CardContent>
          </Card>
        ) : (
          content
        )}
      </div>
    </PageShell>
  )
}
