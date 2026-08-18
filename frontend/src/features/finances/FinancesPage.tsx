import { useEffect, useState } from 'react'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpensesPanel } from '@/features/finances/components/ExpensesPanel'
import { OpenShiftScreen } from '@/features/finances/components/OpenShiftScreen'
import { PosTerminal } from '@/features/finances/components/PosTerminal'
import { ShiftBar } from '@/features/finances/components/ShiftBar'
import { useCurrentShift, useShifts } from '@/features/finances/hooks'
import { formatDateTime, formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function FinancesPage() {
  const { data: shift, isLoading } = useCurrentShift()
  const [tab, setTab] = useState('pos')
  const [expenseIntent, setExpenseIntent] = useState(0)

  useEffect(() => {
    if (expenseIntent > 0) setTab('expenses')
  }, [expenseIntent])

  if (isLoading) {
    return (
      <PageShell title="Finanzas" description="Punto de venta, turno de caja y gastos.">
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </PageShell>
    )
  }

  if (!shift) {
    return (
      <PageShell title="Finanzas" description="Abre tu turno para empezar a cobrar.">
        <OpenShiftScreen />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Finanzas"
      description="Punto de venta, turno de caja y gastos operativos."
      toolbar={
        <ShiftBar shift={shift} onRegisterExpense={() => setExpenseIntent((value) => value + 1)} />
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="pos">Vender</TabsTrigger>
          <TabsTrigger value="expenses">Gastos del turno</TabsTrigger>
          <TabsTrigger value="history">Cortes anteriores</TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <PosTerminal />
        </TabsContent>

        <TabsContent value="expenses" className="flex min-h-0 flex-1 flex-col">
          <ExpensesPanel openIntent={expenseIntent} />
        </TabsContent>

        <TabsContent value="history" className="flex min-h-0 flex-1 flex-col">
          <ShiftHistory />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

function ShiftHistory() {
  const { data, isLoading } = useShifts()

  return (
    <Card className="min-h-0 flex-1">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <TableScroll>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Turno</TableHead>
                <TableHead>Cajero</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Declarado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableEmpty colSpan={6} message="Cargando..." />
              ) : (data?.results ?? []).length === 0 ? (
                <TableEmpty colSpan={6} message="Sin turnos registrados." />
              ) : (
                (data?.results ?? []).map((row) => {
                  const difference = toNumber(row.difference)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.code}</TableCell>
                      <TableCell className="font-medium">{row.cashier_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.closed_at ? formatDateTime(row.closed_at) : 'Abierto'}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {row.closed_at ? formatMoney(row.expected_cash) : '-'}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {row.declared_cash ? formatMoney(row.declared_cash) : '-'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular font-medium',
                          !row.closed_at
                            ? 'text-muted-foreground'
                            : difference === 0
                              ? 'text-status-available'
                              : 'text-status-occupied',
                        )}
                      >
                        {row.closed_at ? formatMoney(row.difference) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableScroll>
      </CardContent>
    </Card>
  )
}
