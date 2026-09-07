import { LuCar, LuClock, LuLogIn, LuLogOut, LuSparkles, LuUser } from 'react-icons/lu'

import { useCountdown } from '@/hooks/useCountdown'
import { formatCountdown, formatMoney, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RoomGridItem } from '@/features/frontdesk/types'
import type { RoomStatus } from '@/types/api'

const STATUS_BAR: Record<RoomStatus, string> = {
  AVAILABLE: 'bg-status-available',
  RESERVED: 'bg-brand-accent',
  OCCUPIED: 'bg-status-occupied',
  CLEANING: 'bg-status-cleaning',
  MAINTENANCE: 'bg-status-maintenance',
  BLOCKED: 'bg-status-maintenance',
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  AVAILABLE: 'text-status-available',
  RESERVED: 'text-brand-accent',
  OCCUPIED: 'text-status-occupied',
  CLEANING: 'text-status-cleaning',
  MAINTENANCE: 'text-status-maintenance',
  BLOCKED: 'text-status-maintenance',
}

/** Tinte del fondo según el estado.
 *
 *  El color sale del token del motel, no de una paleta fija: los cuatro
 *  estados son configurables por cliente (marca blanca) y clavar un esmeralda
 *  o un índigo aquí haría que la tarjeta dejara de obedecer esa configuración.
 *  Lo que sí es fijo es la intensidad -- un 5 % apenas perceptible -- porque de
 *  eso depende que el número de habitación siga siendo lo que más pesa.
 */
const STATUS_TINT: Record<RoomStatus, string> = {
  AVAILABLE: 'bg-status-available/[0.05]',
  RESERVED: 'bg-brand-accent/[0.05]',
  OCCUPIED: 'bg-status-occupied/[0.05]',
  CLEANING: 'bg-status-cleaning/[0.06]',
  MAINTENANCE: 'bg-status-maintenance/[0.05]',
  BLOCKED: 'bg-status-maintenance/[0.05]',
}

const MAX_AVATARES = 4

/** Micro-indicador de ocupación.
 *
 *  Cuatro siluetas y, a partir de ahí, un ``+N``: dibujar ocho avatares en una
 *  tarjeta de 8 rem las convierte en una mancha y deja de leerse el número.
 */
function Ocupantes({ total }: { total: number }) {
  const visibles = Math.min(Math.max(total, 0), MAX_AVATARES)
  const resto = Math.max(total - visibles, 0)

  return (
    <span
      className="flex items-center gap-1"
      title={`${total} ${total === 1 ? 'huésped' : 'huéspedes'}`}
    >
      <span className="flex -space-x-1" aria-hidden>
        {Array.from({ length: visibles }, (_, index) => (
          <span
            key={index}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-card bg-muted"
          >
            <LuUser className="h-2.5 w-2.5 text-muted-foreground" />
          </span>
        ))}
      </span>
      {resto > 0 ? <span className="text-2xs tabular text-muted-foreground">+{resto}</span> : null}
      <span className="sr-only">
        {total} {total === 1 ? 'huésped' : 'huéspedes'}
      </span>
    </span>
  )
}

interface Props {
  room: RoomGridItem
  onSelect: (room: RoomGridItem) => void
  /** Renta rápida: la tarjeta no abre el diálogo de acciones, va directo. */
  onRent: (room: RoomGridItem) => void
  /** Cobrar y cerrar la cuenta de la renta en curso. */
  onCheckout: (room: RoomGridItem) => void
  /** Manda el cuarto al tablero de ama de llaves. */
  onRequestCleaning: (room: RoomGridItem) => void
  /** Marca terminada la limpieza y devuelve el cuarto a disponible. */
  onFinishCleaning: (room: RoomGridItem) => void
  busy?: boolean
  warningMinutes?: number
}

export function RoomCard({
  room,
  onSelect,
  onRent,
  onCheckout,
  onRequestCleaning,
  onFinishCleaning,
  busy = false,
  warningMinutes = 15,
}: Props) {
  const stay = room.current_stay
  const countdown = useCountdown(stay?.expires_at, { warningMinutes })
  const isOccupied = room.status === 'OCCUPIED' && stay !== null

  const timerTone =
    countdown.level === 'expired'
      ? 'text-status-occupied'
      : countdown.level === 'warning'
        ? 'text-status-cleaning'
        : 'text-foreground'

  // Avance de la renta: 0 al entrar, 1 a la hora de salida. Se calcula contra
  // la duración contratada -- salida menos entrada -- y no contra el bloque de
  // tarifa, porque una extensión mueve la salida y la barra tiene que seguirla.
  const progreso = ((): number | null => {
    if (!isOccupied || !stay) return null
    const total =
      (new Date(stay.expires_at).getTime() - new Date(stay.check_in_at).getTime()) / 1000
    if (!Number.isFinite(total) || total <= 0) return null
    return Math.min(Math.max(1 - countdown.seconds / total, 0), 1)
  })()

  return (
    <div
      className={cn(
        'group relative flex min-h-[8.5rem] w-full flex-col overflow-hidden rounded-lg',
        'border border-border/60 bg-card text-left',
        STATUS_TINT[room.status],
        'transition-colors duration-150 focus-within:border-foreground/25 hover:border-foreground/25',
        isOccupied && countdown.level === 'expired' && 'border-status-occupied/50',
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[3px]',
          STATUS_BAR[room.status],
          isOccupied && countdown.level === 'expired' && 'animate-pulse-alert',
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onSelect(room)}
        aria-label={`Habitación ${room.number}, ${room.status_display}`}
        className={cn(
          'flex flex-1 flex-col p-4 text-left',
          'transition-colors duration-150 hover:bg-accent/30 active:bg-accent/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-2xl font-medium leading-none tracking-tightest">
              {room.number}
            </p>
            <p className="mt-2 truncate text-xs text-muted-foreground">{room.room_type_name}</p>
          </div>

          {!isOccupied ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide',
                STATUS_TEXT[room.status],
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', STATUS_BAR[room.status])}
                aria-hidden
              />
              {room.status_display}
            </span>
          ) : (
            <Ocupantes total={stay?.occupants ?? 0} />
          )}
        </div>

        {isOccupied && stay ? (
          <div className="mt-auto space-y-2 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn('flex items-baseline gap-1.5', timerTone)}>
                <LuClock className="h-3.5 w-3.5 shrink-0 self-center" aria-hidden />
                <span className="font-mono text-lg font-medium leading-none tracking-tight">
                  {formatCountdown(countdown.seconds)}
                </span>
              </span>
              <span className="text-2xs text-muted-foreground">
                sale {formatTime(stay.expires_at)}
              </span>
            </div>

            {progreso !== null ? (
              <div
                className="h-1 w-full overflow-hidden rounded-full bg-foreground/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progreso * 100)}
                aria-label="Tiempo transcurrido de la renta"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500 ease-linear',
                    countdown.level === 'expired'
                      ? 'bg-status-occupied'
                      : countdown.level === 'warning'
                        ? 'bg-status-cleaning'
                        : 'bg-foreground/40',
                  )}
                  style={{ width: `${progreso * 100}%` }}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
              <span className="flex items-center gap-2.5">
                {stay.vehicle_plate ? (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
                    <LuCar className="h-3 w-3" aria-hidden />
                    {stay.vehicle_plate}
                  </span>
                ) : null}
              </span>
              {stay.folio_total ? (
                <span className="font-mono font-medium text-foreground">
                  {formatMoney(stay.folio_total)}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-3">
            {room.out_of_service_reason ? (
              <p className="line-clamp-2 text-2xs text-muted-foreground">
                {room.out_of_service_reason}
              </p>
            ) : (
              <p className="text-2xs text-muted-foreground/60">
                {room.status === 'AVAILABLE'
                  ? 'Lista para rentar'
                  : room.zone || 'Sin renta activa'}
              </p>
            )}
          </div>
        )}
      </button>

      <AccionesRapidas
        room={room}
        busy={busy}
        onRent={onRent}
        onCheckout={onCheckout}
        onRequestCleaning={onRequestCleaning}
        onFinishCleaning={onFinishCleaning}
      />
    </div>
  )
}

/** Lo que se hace con un cuarto sin abrir nada.
 *
 *  Una acción por estado, la que se repite todo el turno; el resto sigue en el
 *  menú contextual. Dos botones ya obligan a leer la tarjeta antes de hacer
 *  clic, que es justo lo que un mostrador con fila no puede permitirse.
 */
function AccionesRapidas({
  room,
  busy,
  onRent,
  onCheckout,
  onRequestCleaning,
  onFinishCleaning,
}: {
  room: RoomGridItem
  busy: boolean
  onRent: (room: RoomGridItem) => void
  onCheckout: (room: RoomGridItem) => void
  onRequestCleaning: (room: RoomGridItem) => void
  onFinishCleaning: (room: RoomGridItem) => void
}) {
  const acciones: { label: string; icon: React.ReactNode; onClick: () => void }[] = (() => {
    switch (room.status) {
      case 'AVAILABLE':
      case 'RESERVED':
        return [
          {
            label: 'Rentar',
            icon: <LuLogIn className="h-3 w-3" aria-hidden />,
            onClick: () => onRent(room),
          },
          {
            label: 'Limpieza',
            icon: <LuSparkles className="h-3 w-3" aria-hidden />,
            onClick: () => onRequestCleaning(room),
          },
        ]
      case 'OCCUPIED':
        return room.current_stay
          ? [
              {
                label: 'Cobrar y salir',
                icon: <LuLogOut className="h-3 w-3" aria-hidden />,
                onClick: () => onCheckout(room),
              },
            ]
          : []
      case 'CLEANING':
        return [
          {
            label: 'Limpieza lista',
            icon: <LuSparkles className="h-3 w-3" aria-hidden />,
            onClick: () => onFinishCleaning(room),
          },
        ]
      default:
        // Mantenimiento y bloqueado no tienen acción de un clic: sacarlos de
        // ahí exige un motivo escrito, y eso ya vive en el diálogo.
        return []
    }
  })()

  if (acciones.length === 0) return null

  return (
    <div className="flex divide-x divide-border/60 border-t border-border/60">
      {acciones.map((accion) => (
        <button
          key={accion.label}
          type="button"
          disabled={busy}
          onClick={accion.onClick}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-2xs font-medium',
            'text-muted-foreground transition-colors duration-150',
            'hover:bg-accent hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {accion.icon}
          {accion.label}
        </button>
      ))}
    </div>
  )
}
