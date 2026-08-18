import { useEffect, useState } from 'react'

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
import { toast } from '@/components/ui/toast'
import { useChangePassword } from '@/features/auth/hooks'
import { apiErrorMessage } from '@/lib/axios'
import { useAuthStore } from '@/store/auth'

export function ChangePasswordDialog({
  open,
  required = false,
  onOpenChange,
}: {
  open: boolean
  required?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useChangePassword()
  const resetMutation = mutation.reset
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!open) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmation('')
    resetMutation()
  }, [open, resetMutation])

  const valid =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmation

  const submit = (): void => {
    mutation.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          if (user) setUser({ ...user, must_change_password: false })
          toast.success('Contraseña actualizada')
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!required || next) && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {required ? 'Crea una contraseña personal' : 'Cambiar contraseña'}
          </DialogTitle>
          <DialogDescription>
            {required
              ? 'Antes de continuar, reemplaza la contraseña temporal que te asignaron.'
              : 'Escribe tu contraseña actual y elige una nueva.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              aria-invalid={confirmation.length > 0 && confirmation !== newPassword}
            />
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive">
              {apiErrorMessage(mutation.error, 'No se pudo cambiar la contraseña.')}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {!required ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          ) : null}
          <Button disabled={!valid} loading={mutation.isPending} onClick={submit}>
            Guardar contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
