import { useEffect, useState } from 'react'
import { PiLock } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { ModuleHelp } from '@/components/layout/ModuleHelp'
import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/states'
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
import { openShiftDialog } from '@/features/finances/components/OpenShiftDialog'
import { OpenShiftScreen } from '@/features/finances/components/OpenShiftScreen'
import { PosTerminal } from '@/features/finances/components/PosTerminal'
import { ShiftBar } from '@/features/finances/components/ShiftBar'
import { useCurrentShift, useShifts } from '@/features/finances/hooks'
import { formatDateTime, formatMoney, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function FinancesPage() {
  const { t } = useTranslation()
  const { data: shift, isLoading } = useCurrentShift()
  const [tab, setTab] = useState('pos')
  const [expenseIntent, setExpenseIntent] = useState(0)

  useEffect(() => {
    if (expenseIntent > 0) setTab('expenses')
  }, [expenseIntent])

  if (isLoading) {
    return (
      <PageShell title={t('caja.titulo')} description={t('caja.subtitulo')}>
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </PageShell>
    )
  }

  return (
    <PageShell
      title={t('caja.titulo')}
      description={shift ? t('caja.subtituloOperativos') : t('caja.turnoCerradoAviso')}
      actions={<ModuleHelp modulo="caja" />}
      toolbar={
        shift ? (
          <ShiftBar
            shift={shift}
            onRegisterExpense={() => setExpenseIntent((value) => value + 1)}
          />
        ) : undefined
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="pos">{t('caja.vender')}</TabsTrigger>
          <TabsTrigger value="expenses">{t('caja.gastosDelTurno')}</TabsTrigger>
          <TabsTrigger value="history">{t('caja.cortesAnteriores')}</TabsTrigger>
        </TabsList>

        {/* Sin turno no se cobra ni se gasta, pero los cortes anteriores sí se
            consultan: son historia cerrada, no dependen de la caja de hoy.
            Antes la falta de turno reemplazaba la página entera y quien venía a
            revisar el corte de ayer tenía que abrir una caja para verlo. La
            regla general es la misma en todas partes: se bloquea lo que de
            verdad necesita el requisito, y el bloqueo trae el botón que lo
            resuelve. */}
        <TabsContent value="pos" className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          {shift ? <PosTerminal /> : <OpenShiftScreen />}
        </TabsContent>

        <TabsContent value="expenses" className="flex min-h-0 flex-1 flex-col">
          {shift ? (
            <ExpensesPanel openIntent={expenseIntent} />
          ) : (
            <Card className="min-h-0 flex-1">
              <EmptyState
                title={t('caja.gastosContraTurno')}
                description={t('caja.gastoSinTurno')}
                icon={<PiLock className="h-8 w-8" aria-hidden />}
                action={<Button onClick={openShiftDialog}>{t('caja.abrirTurnoDeCaja')}</Button>}
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex min-h-0 flex-1 flex-col">
          <ShiftHistory />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

function ShiftHistory() {
  const { t } = useTranslation()
  const { data, isLoading, isError, isFetching, refetch } = useShifts()

  if (isError) {
    return (
      <Card className="min-h-0 flex-1">
        <ErrorState
          title={t('caja.noPudimosCortes')}
          description={t('caja.historialNoLlego')}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </Card>
    )
  }

  return (
    <Card className="min-h-0 flex-1">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <TableScroll>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>{t('caja.turno')}</TableHead>
                <TableHead>{t('caja.cajero')}</TableHead>
                <TableHead>{t('caja.cierre')}</TableHead>
                <TableHead className="text-right">{t('caja.esperado')}</TableHead>
                <TableHead className="text-right">{t('caja.declarado')}</TableHead>
                <TableHead className="text-right">{t('caja.diferencia')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableEmpty colSpan={6} message={t('caja.cargando')} />
              ) : (data?.results ?? []).length === 0 ? (
                <TableEmpty colSpan={6} message={t('caja.sinCortes')} />
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
