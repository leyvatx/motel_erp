import { NavLink } from 'react-router-dom'

import { NAV_GROUPS } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'
import { canAccessSection, useAuthStore } from '@/store/auth'

/** Cuántos destinos caben abajo sin que las etiquetas se corten. */
const MAX_DESTINOS = 5

/** El orden de la barra no es el del menú, es el del turno.
 *
 *  El menú lateral agrupa por tema y ahí Inicio va primero. Abajo lo que manda
 *  es la frecuencia: recepción salta entre el tablero y la caja todo el día, y
 *  ama de llaves vive en su lista. Tomar los cinco primeros del menú dejaba
 *  fuera justo Caja, que es de los destinos más usados. */
const PRIORIDAD: readonly string[] = [
  'frontdesk',
  'finances',
  'housekeeping',
  'dashboard',
  'inventory',
  'reservations',
]

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
 *   dos destinos y recepción cinco. Nadie ve una barra con secciones a las que
 *   no puede entrar.
 * - Un administrador de plataforma o un usuario corporativo no la ve: su
 *   trabajo no es operar un mostrador, y una barra de operación diaria abajo
 *   sería una jerarquía prestada de otro rol.
 * - Con un solo destino tampoco aparece: una barra de un botón no es
 *   navegación, es ruido.
 *
 * El resto de secciones sigue en el menú lateral, que no se va a ninguna parte.
 */
export function MobileTabBar() {
  const user = useAuthStore((state) => state.user)

  const operacion = NAV_GROUPS.find((group) => group.id === 'daily')?.items ?? []
  const destinos = operacion
    .filter((item) => canAccessSection(user, item.section))
    .sort((a, b) => PRIORIDAD.indexOf(a.section) - PRIORIDAD.indexOf(b.section))
    .slice(0, MAX_DESTINOS)

  if (destinos.length < 2) return null

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
              'flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 px-1 outline-none',
              'transition-colors duration-150 focus-visible:bg-accent',
              isActive ? 'text-foreground' : 'text-muted-foreground active:bg-accent/60',
            )
          }
        >
          {({ isActive }) => (
            <>
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
    </nav>
  )
}
