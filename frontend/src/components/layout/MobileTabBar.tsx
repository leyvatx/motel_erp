import { NavLink } from 'react-router-dom'
import { PiDotsThreeOutline } from 'react-icons/pi'

import { NAV_GROUPS } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'

/**
 * Cuatro destinos y un "Más".
 *
 * A cinco columnas las etiquetas empiezan a partirse en un teléfono de 320 px,
 * y una barra que se lee a medias deja de ser un atajo. Cuatro caben con la
 * palabra entera y dejan sitio para la salida hacia el resto del sistema, que
 * es lo que evita que la barra se convierta en el techo de lo que se puede
 * hacer desde el teléfono.
 */
const MAX_DESTINOS = 4

/** El orden de la barra no es el del menú, es el del turno.
 *
 *  El menú lateral agrupa por tema y ahí Inicio va primero. Abajo lo que manda
 *  es la frecuencia: recepción salta entre el tablero y la caja todo el día, y
 *  ama de llaves vive en su lista. Tomar los primeros del menú dejaba fuera
 *  justo Caja, que es de los destinos más usados. */
const PRIORIDAD: readonly string[] = [
  'frontdesk',
  'finances',
  'housekeeping',
  'dashboard',
  'inventory',
  'reservations',
]

const CLASE_CELDA = [
  'relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 px-1 outline-none',
  'transition-colors duration-150 focus-visible:bg-accent',
].join(' ')

interface Props {
  /** Abre el menú lateral, que es donde vive todo lo que no cabe abajo. */
  onOpenMenu: () => void
}

/**
 * Barra inferior con lo que se usa a diario, al alcance del pulgar.
 *
 * En el teléfono los destinos operativos vivían detrás del menú hamburguesa:
 * dos toques y un recorrido con la vista para saltar de Recepción a Caja, algo
 * que en un turno se hace decenas de veces. Aquí están a un toque, en la franja
 * baja que la mano ya cubre.
 *
 * No la ve todo el mundo, y eso es a propósito:
 *
 * - Sale del grupo "Operación" filtrado por el rol, así que ama de llaves ve
 *   dos destinos y recepción cuatro. Nadie ve una barra con secciones a las que
 *   no puede entrar.
 * - Un administrador de plataforma o un usuario corporativo no la ve: su
 *   trabajo no es operar un mostrador, y una barra de operación diaria abajo
 *   sería una jerarquía prestada de otro rol.
 * - Con un solo destino tampoco aparece: una barra de un botón no es
 *   navegación, es ruido.
 */
export function MobileTabBar({ onOpenMenu }: Props) {
  const user = useAuthStore((state) => state.user)

  const operacion = NAV_GROUPS.find((group) => group.id === 'daily')?.items ?? []
  const accesibles = operacion
    .filter((item) => canAccessSection(user, item.section))
    .sort((a, b) => PRIORIDAD.indexOf(a.section) - PRIORIDAD.indexOf(b.section))

  if (accesibles.length < 2) return null

  const destinos = accesibles.slice(0, MAX_DESTINOS)

  return (
    <nav
      aria-label="Accesos de operación"
      // El relleno inferior es la franja del gesto del teléfono: sin él, el
      // último destino queda debajo de la barra del sistema.
      className="z-30 flex shrink-0 items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {destinos.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              CLASE_CELDA,
              isActive ? 'text-foreground' : 'text-muted-foreground active:bg-accent/60',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* La barra activa arriba es lo que marca el destino cuando el
                  color no basta: daltonismo, sol de mediodía sobre la pantalla,
                  o un tema de marca con poco contraste entre los dos estados. */}
              <span
                className={cn(
                  'absolute top-0 h-0.5 w-8 rounded-b-full bg-foreground transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              <span
                className={cn(
                  'max-w-full truncate text-2xs leading-none',
                  isActive && 'font-medium',
                )}
              >
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      {/* Todo lo que no cabe: el resto de la operación, gestión y
          configuración. Sin esta salida, la barra sería el techo de lo que se
          puede hacer desde un teléfono. */}
      <button
        type="button"
        onClick={onOpenMenu}
        className={cn(CLASE_CELDA, 'text-muted-foreground active:bg-accent/60')}
        aria-label="Ver todas las secciones"
      >
        <PiDotsThreeOutline className="h-5 w-5 shrink-0" aria-hidden />
        <span className="text-2xs leading-none">Más</span>
      </button>
    </nav>
  )
}
