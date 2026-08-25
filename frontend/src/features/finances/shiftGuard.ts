import { toast } from '@/components/ui/toast'
import { openShiftDialog } from '@/features/finances/components/OpenShiftDialog'
import { apiErrorCode, apiErrorMessage } from '@/lib/axios'

/**
 * Cobrar, vender y registrar gastos exigen turno de caja abierto. Cuando el
 * servidor lo niega, el aviso trae el botón que lo resuelve sin salir de aquí.
 */
export function toastApiError(title: string, error: unknown): void {
  if (apiErrorCode(error) === 'shift_required') {
    toast.error(title, apiErrorMessage(error), {
      label: 'Abrir turno de caja',
      onSelect: openShiftDialog,
    })
    return
  }

  toast.error(title, apiErrorMessage(error))
}
