import { toast } from '@/components/ui/toast'
import { openShiftDialog } from '@/features/finances/components/OpenShiftDialog'
import { apiErrorCode, apiErrorMessage } from '@/lib/axios'
// Fuera de un componente no hay hook que valga: aquí se usa la instancia
// directa, que es la misma que alimenta a `useTranslation`.
import i18n from '@/lib/i18n'

/**
 * Cobrar, vender y registrar gastos exigen turno de caja abierto. Cuando el
 * servidor lo niega, el aviso trae el botón que lo resuelve sin salir de aquí.
 */
export function toastApiError(title: string, error: unknown): void {
  if (apiErrorCode(error) === 'shift_required') {
    toast.error(title, apiErrorMessage(error), {
      label: i18n.t('caja.abrirTurnoDeCaja'),
      onSelect: openShiftDialog,
    })
    return
  }

  toast.error(title, apiErrorMessage(error))
}
