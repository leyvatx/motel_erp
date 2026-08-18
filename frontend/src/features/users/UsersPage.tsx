import { useState } from 'react'
import { KeyRound, Pencil, UserCheck, UserPlus, UserX } from 'lucide-react'

import { PageShell, TableScroll } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { RowActions, useRowContextMenu, type RowAction } from '@/components/ui/row-actions'
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
import { UserFormDialog } from '@/features/users/components/UserFormDialog'
import {
  useDeactivateUser,
  useForcePasswordChange,
  useRestoreUser,
  useRoles,
  useUsers,
} from '@/features/users/hooks'
import { initials, roleTone } from '@/features/users/presence'
import { formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { Role, User } from '@/types/api'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function UsersPage() {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const contextMenu = useRowContextMenu()
  const roles = useRoles()
  const deactivate = useDeactivateUser()
  const restore = useRestoreUser()
  const forcePassword = useForcePasswordChange()
  const [editing, setEditing] = useState<User | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | Role>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const users = useUsers({
    page,
    page_size: pageSize,
    search: search || undefined,
    role: role === 'all' ? undefined : role,
    include_inactive: status !== 'active' ? true : undefined,
    is_active: status === 'all' ? undefined : status === 'active',
    ordering: 'full_name',
  })

  const openCreate = (): void => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (user: User): void => {
    setEditing(user)
    setFormOpen(true)
  }

  const actionsFor = (user: User): RowAction[] => [
    {
      key: 'edit',
      label: 'Editar usuario',
      icon: <Pencil />,
      onSelect: () => openEdit(user),
    },
    {
      key: 'password',
      label: 'Forzar nueva contraseña',
      icon: <KeyRound />,
      onSelect: () => forcePassword.mutate(user.id),
      disabled: !user.is_active,
    },
    user.is_active
      ? {
          key: 'deactivate',
          label: 'Desactivar usuario',
          icon: <UserX />,
          danger: true,
          separated: true,
          disabled: user.id === currentUserId,
          onSelect: () => {
            if (window.confirm(`¿Desactivar a ${user.full_name}? Ya no podrá iniciar sesión.`)) {
              deactivate.mutate(user.id)
            }
          },
        }
      : {
          key: 'restore',
          label: 'Reactivar usuario',
          icon: <UserCheck />,
          separated: true,
          onSelect: () => restore.mutate(user.id),
        },
  ]

  return (
    <PageShell
      title="Usuarios"
      description="Altas, roles y acceso del personal de este motel."
      actions={
        <Button onClick={openCreate}>
          <UserPlus />
          Nuevo usuario
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar nombre, usuario o empleado"
            className="min-w-64 flex-1 sm:max-w-sm"
            aria-label="Buscar usuarios"
          />
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value as 'all' | Role)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {(roles.data ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isLoading ? (
                Array.from({ length: 7 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.data?.results.length ? (
                users.data.results.map((user) => {
                  const actions = actionsFor(user)
                  return (
                    <TableRow
                      key={user.id}
                      onDoubleClick={() => openEdit(user)}
                      onContextMenu={contextMenu(user.full_name, actions)}
                      className="cursor-default"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                              roleTone(user.role),
                              !user.is_active && 'opacity-40 grayscale',
                            )}
                          >
                            {initials(user.full_name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {user.full_name}
                              {user.id === currentUserId ? (
                                <span className="ml-1 text-xs text-muted-foreground">(tú)</span>
                              ) : null}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              @{user.username}
                              {user.employee_number ? ` · ${user.employee_number}` : ''}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.role_display}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={user.is_active ? 'available' : 'secondary'}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {user.must_change_password ? (
                            <Badge variant="outline">Cambiar contraseña</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.last_login ? formatRelative(user.last_login) : 'Nunca'}
                      </TableCell>
                      <TableCell>{formatDate(user.hired_at)}</TableCell>
                      <TableCell>
                        <RowActions items={actions} label={user.full_name} />
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableEmpty colSpan={6} message="No se encontraron usuarios." />
              )}
            </TableBody>
          </Table>
        </TableScroll>

        {users.data ? (
          <Pagination
            page={users.data.page}
            pageSize={users.data.page_size}
            count={users.data.count}
            totalPages={users.data.total_pages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            isFetching={users.isFetching}
          />
        ) : null}
      </Card>

      <UserFormDialog open={formOpen} user={editing} onOpenChange={setFormOpen} />
    </PageShell>
  )
}
