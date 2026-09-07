import { useSyncExternalStore } from 'react'

/** Suscripción a una media query.
 *
 *  Va con `useSyncExternalStore` y no con `useState` + `useEffect`: así el
 *  primer render ya sabe el tamaño real de la pantalla. Con el efecto, el
 *  primer pintado usa siempre el valor por omisión y lo corrige después, que
 *  en un diálogo se ve como un salto de centro a fondo de pantalla.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      const lista = window.matchMedia(query)
      lista.addEventListener('change', alCambiar)
      return () => lista.removeEventListener('change', alCambiar)
    },
    () => window.matchMedia(query).matches,
    // En el servidor no hay pantalla; se asume la de escritorio.
    () => false,
  )
}

/** Menos de 640 px: el punto donde Tailwind corta `sm` y donde el pulgar deja
 *  de alcanzar la parte de arriba de la pantalla. */
export function useEsMovil(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
