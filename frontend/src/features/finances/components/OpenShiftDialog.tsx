import { useTranslation } from 'react-i18next'
import { create } from 'zustand'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OpenShiftForm } from '@/features/finances/components/OpenShiftForm'

interface ShiftDialogState {
  open: boolean
  show: () => void
  hide: () => void
}

const useShiftDialogStore = create<ShiftDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))

export function openShiftDialog(): void {
  useShiftDialogStore.getState().show()
}

export function OpenShiftDialog() {
  const { t } = useTranslation()
  const { open, hide } = useShiftDialogStore()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && hide()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('caja.abrirTuTurno')}</DialogTitle>
          <DialogDescription>
            Cuenta el fondo del cajón y captúralo. Todo lo que cobres a partir de aquí queda ligado
            a este turno y a tu usuario.
          </DialogDescription>
        </DialogHeader>

        <OpenShiftForm onOpened={hide} />
      </DialogContent>
    </Dialog>
  )
}
