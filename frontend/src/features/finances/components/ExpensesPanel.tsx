import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'

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
  { value: 'SUPPLIES', label: 'Insumos' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'UTILITIES', label: 'Servicios' },
  { value: 'PAYROLL', label: 'Nomina y viaticos' },
  { value: 'CLEANING', label: 'Limpieza' },
  { value: 'TRANSPORT', label: 'Transporte' },
  { value: 'OTHER', label: 'Otro' },
] as const

const STATUS_VARIANT: Record<string, 'available' | 'cleaning' | 'occupied' | 'secondary'> = {
  APPROVED: 'available',
  PENDING: 'cleaning',
  REJECTED: 'occupied',
  CANCELLED: 'secondary',
}

function NewExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateExpense()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('SUPPLIES')
  const [supplier, setSupplier] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>
            Arriba del umbral configurado, el gasto espera aprobación de gerencia antes de salir
            de caja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Importe</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Garrafones de agua"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Proveedor (opcional)</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
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
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExpensesPanel({ openIntent = 0 }: { openIntent?: number }) {
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
        icon: <Check />,
        onSelect: () => review.mutate({ expenseId: expense.id, approve: true }),
      },
      {
        key: 'reject',
        label: 'Rechazar gasto',
        icon: <X />,
        danger: true,
        separated: true,
        onSelect: () =>
          review.mutate({
            expenseId: expense.id,
            approve: false,
            notes: 'Rechazado desde el panel de gastos',
          }),
      },
    ]
  }

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Gastos del turno</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Registrar gasto
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <TableScroll>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Solicito</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={6} message="Cargando..." />
            ) : (data?.results ?? []).length === 0 ? (
              <TableEmpty colSpan={6} message="Sin gastos registrados." />
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
