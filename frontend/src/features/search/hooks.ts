import { useQuery } from '@tanstack/react-query'

import { searchEverything } from '@/features/search/api'
import type { SearchScope } from '@/features/search/types'
import { canAccessSection, useAuthStore } from '@/store/auth'

export const MINIMO_CARACTERES = 2

export function useSearchScope(): SearchScope {
  const user = useAuthStore((state) => state.user)

  // Ama de llaves no consulta folios ni reservaciones: no puede abrirlos y
  // pedirlos solo le cuesta latencia al servidor.
  return {
    stays: canAccessSection(user, 'frontdesk'),
    rooms: canAccessSection(user, 'frontdesk'),
    reservations: canAccessSection(user, 'reservations'),
    folios: canAccessSection(user, 'finances'),
  }
}

export function useGlobalSearch(term: string) {
  const scope = useSearchScope()

  return useQuery({
    queryKey: ['search', term, scope] as const,
    // La señal viene de React Query y se encadena a axios: al teclear otra
    // letra, la petición anterior se aborta en vez de competir por llegar.
    queryFn: ({ signal }) => searchEverything(term, scope, signal),
    enabled: term.length >= MINIMO_CARACTERES,
    staleTime: 30_000,
    // Borrar una letra y volver a escribirla no vacía el panel mientras carga.
    placeholderData: (previous) => previous,
  })
}
