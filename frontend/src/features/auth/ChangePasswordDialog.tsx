import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
          toast.success(t('acceso.contrasenaActualizada'))
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
            {required ? t('acceso.creaContrasenaPersonal') : t('acceso.cambiarContrasena')}
          </DialogTitle>
          <DialogDescription>
            {required ? t('acceso.antesDeContinuar') : t('acceso.escribeTuActual')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('acceso.contrasenaActual')}</Label>
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
            <Label htmlFor="new-password">{t('acceso.nuevaContrasena')}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={t('acceso.minimo8')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('acceso.confirmarContrasena')}</Label>
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
              {apiErrorMessage(mutation.error, t('acceso.noSePudoCambiar'))}
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
