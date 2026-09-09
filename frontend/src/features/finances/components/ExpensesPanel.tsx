import { useEffect, useState } from 'react'
import { PiCheck, PiPlus, PiX } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableScroll } from '@/components/layout/PageShell'
import { RowActions, useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
import { useCreateExpense, useExpenses, useReviewExpense } from '@/features/finances/hooks'
import type { Expense } from '@/features/finances/types'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useAuthStore } from '@/store/auth'

const CATEGORIES = [
  // Claves, no texto: esta tabla vive fuera del componente y se evalua una sola
  // vez al importar. Con la cadena adentro, cambiar de idioma no la movia.
  { value: 'SUPPLIES', label: 'caja.catInsumos' },
  { value: 'MAINTENANCE', label: 'caja.catMantenimiento' },
  { value: 'UTILITIES', label: 'caja.catServicios' },
  { value: 'PAYROLL', label: 'caja.nominaYViaticos' },
  { value: 'CLEANING', label: 'caja.catLimpieza' },
  { value: 'TRANSPORT', label: 'caja.catTransporte' },
  { value: 'OTHER', label: 'caja.catOtro' },
] as const

const STATUS_VARIANT: Record<string, 'available' | 'cleaning' | 'occupied' | 'secondary'> = {
  APPROVED: 'available',
  PENDING: 'cleaning',
  REJECTED: 'occupied',
  CANCELLED: 'secondary',
}

function NewExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const create = useCreateExpense()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('SUPPLIES')
  const [supplier, setSupplier] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('caja.registrarGasto')}</DialogTitle>
          <DialogDescription>
            Arriba del umbral configurado, el gasto espera aprobación de gerencia antes de salir de
            caja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('caja.importe')}</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t('caja.categoria')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('caja.descripcion')}</Label>
            <Input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('caja.ejemploGasto')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">{t('caja.proveedorOpcional')}</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('caja.cancelar')}
          </Button>
          <Button
            disabled={!amount || description.trim().length < 3}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { amount, description, category, supplier },
                {
                  onSuccess: () => {
                    setAmount('')
                    setDescription('')
                    setSupplier('')
                    onOpenChange(false)
                  },
                },
              )
            }
          >
            {t('caja.registrar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExpensesPanel({ openIntent = 0 }: { openIntent?: number }) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (openIntent > 0) setCreating(true)
  }, [openIntent])

  const { data, isLoading } = useExpenses()
  const review = useReviewExpense()
  const openContextMenu = useRowContextMenu()
  const isManagement = useAuthStore(
    (state) => state.user?.role === 'MANAGER' || state.user?.role === 'SUPERADMIN',
  )

  const actionsFor = (expense: Expense): RowAction[] => {
    if (!isManagement || expense.status !== 'PENDING') return []
    return [
      {
        key: 'approve',
        label: 'Aprobar gasto',
        icon: <PiCheck />,
        onSelect: () => review.mutate({ expenseId: expense.id, approve: true }),
      },
      {
        key: 'reject',
        label: 'Rechazar gasto',
        icon: <PiX />,
        danger: true,
        separated: true,
        onSelect: () =>
          review.mutate({
            expenseId: expense.id,
            approve: false,
            notes: t('caja.rechazadoDesdeGastos'),
          }),
      },
    ]
  }

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('caja.gastosDelTurno')}</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PiPlus className="h-4 w-4" />
          {t('caja.registrarGasto')}
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <TableScroll>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>{t('caja.folio')}</TableHead>
                <TableHead>{t('caja.concepto')}</TableHead>
                <TableHead>Solicito</TableHead>
                <TableHead className="text-right">{t('caja.importe')}</TableHead>
                <TableHead>{t('caja.estado')}</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableEmpty colSpan={6} message={t('caja.cargando')} />
              ) : (data?.results ?? []).length === 0 ? (
                <TableEmpty colSpan={6} message={t('caja.sinGastos')} />
              ) : (
                (data?.results ?? []).map((expense) => (
                  <TableRow
                    key={expense.id}
                    onContextMenu={openContextMenu(expense.description, actionsFor(expense))}
                    className="cursor-context-menu"
                  >
                    <TableCell className="font-mono text-xs">{expense.folio}</TableCell>
                    <TableCell>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {expense.category_display} - {formatDateTime(expense.created_at)}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {expense.requested_by_name}
                    </TableCell>
                    <TableCell className="text-right tabular font-semibold">
                      {formatMoney(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[expense.status] ?? 'secondary'}>
                        {expense.status_display}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions items={actionsFor(expense)} label={expense.folio} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScroll>
      </CardContent>

      <NewExpenseDialog open={creating} onOpenChange={setCreating} />
    </Card>
  )
}
