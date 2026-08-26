import { useNavigate } from 'react-router-dom'

import { openShiftDialog } from '@/features/finances/components/OpenShiftDialog'
import { useCurrentShift } from '@/features/finances/hooks'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'

export function ShiftChip() {
  const user = useAuthStore((state) => state.user)
  const canCash = canAccessSection(user, 'finances')
  const { data: shift, isLoading } = useCurrentShift(canCash)
  const navigate = useNavigate()

  if (!canCash || isLoading) return null

  const open = Boolean(shift)

  return (
    <button
      type="button"
      onClick={() => (open ? navigate('/finances') : openShiftDialog())}
      title={
        open
          ? `Turno ${shift?.code} abierto. Ir a caja.`
          : 'No puedes cobrar sin turno abierto. Ábrelo aquí.'
      }
      className={cn(
        'hidden max-w-[13rem] shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-2xs font-medium transition-colors sm:flex',
        open
          ? 'text-muted-foreground hover:bg-accent'
          : 'border-status-cleaning/50 text-status-cleaning hover:bg-status-cleaning/10',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          open ? 'bg-status-available' : 'animate-pulse-alert bg-status-cleaning',
        )}
        aria-hidden
      />
      {/* El folio completo solo donde cabe. Abajo de lg basta con saber que hay
          turno abierto; el codigo entero aplastaba el topbar y se salia. El
          title de arriba lo sigue diciendo completo. */}
      <span className="truncate">
        {open ? 'Turno' : 'Sin turno'}
        {open ? <span className="hidden lg:inline"> {shift?.code}</span> : null}
      </span>
    </button>
  )
}
