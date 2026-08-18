import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
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
import { useCreateUser, useRoles, useUpdateUser } from '@/features/users/hooks'
import type { UserPayload } from '@/features/users/types'
import type { Role, User } from '@/types/api'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function UserFormDialog({
  open,
  user,
  onOpenChange,
}: {
  open: boolean
  user: User | null
  onOpenChange: (open: boolean) => void
}) {
  const roles = useRoles()
  const create = useCreateUser()
  const update = useUpdateUser()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('RECEPTION')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [hiredAt, setHiredAt] = useState('')
  const [password, setPassword] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(true)

  useEffect(() => {
    if (!open) return
    setUsername(user?.username ?? '')
    setFullName(user?.full_name ?? '')
    setRole(user?.role ?? 'RECEPTION')
    setEmployeeNumber(user?.employee_number ?? '')
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
    setHiredAt(user?.hired_at ?? '')
    setPassword('')
    setMustChangePassword(user?.must_change_password ?? true)
  }, [open, user])

  const usernameValid = /^[a-z0-9._-]{3,40}$/.test(username)
  const passwordValid = user ? password.length === 0 || password.length >= 8 : password.length >= 8
  const valid = usernameValid && fullName.trim().length >= 3 && passwordValid

  const submit = (): void => {
    const payload: UserPayload = {
      username: username.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
      employee_number: employeeNumber.trim(),
      email: email.trim(),
      phone: phone.trim(),
      hired_at: hiredAt || null,
      must_change_password: mustChangePassword,
      ...(password ? { password } : {}),
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (user) update.mutate({ id: user.id, payload }, done)
    else create.mutate(payload, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? `Editar ${user.full_name}` : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            Define sus datos de acceso y el rol que tendrá dentro de este motel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="user-full-name">
            <Input
              id="user-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Usuario" htmlFor="user-username">
            <Input
              id="user-username"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="recepcion.turno1"
              aria-invalid={username.length > 0 && !usernameValid}
            />
          </Field>
          <Field label="Rol" htmlFor="user-role">
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Número de empleado" htmlFor="user-employee-number">
            <Input
              id="user-employee-number"
              value={employeeNumber}
              onChange={(event) => setEmployeeNumber(event.target.value)}
            />
          </Field>
          <Field label="Correo" htmlFor="user-email">
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Teléfono" htmlFor="user-phone">
            <Input
              id="user-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label="Fecha de ingreso" htmlFor="user-hired-at">
            <Input
              id="user-hired-at"
              type="date"
              value={hiredAt}
              onChange={(event) => setHiredAt(event.target.value)}
            />
          </Field>
          <Field
            label={user ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
            htmlFor="user-password"
          >
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={mustChangePassword}
            onChange={(event) => setMustChangePassword(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="block font-medium">Cambiar contraseña al iniciar sesión</span>
            <span className="text-xs text-muted-foreground">
              Recomendado cuando otra persona asigna la contraseña inicial.
            </span>
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valid} loading={create.isPending || update.isPending} onClick={submit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
