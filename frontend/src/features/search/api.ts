import { get } from '@/lib/axios'
import type { Reservation, Room, StayListItem } from '@/features/frontdesk/types'
import type { Folio } from '@/features/sales/types'
import type { PaginatedResponse } from '@/types/api'
import type { SearchGroup, SearchHit, SearchScope } from '@/features/search/types'

/** Cinco por categoría. Con cinco grupos son veinticinco renglones como techo:
 *  de sobra para un desplegable y una fracción del payload de traer veinte de
 *  cada uno. */
const POR_CATEGORIA = 5

const ESTADO_HABITACION: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  CLEANING: 'En limpieza',
  MAINTENANCE: 'Mantenimiento',
  RESERVED: 'Reservada',
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

/** Devuelve la lista si la petición salió bien, y vacío si no.
 *
 *  Es lo que hace que una categoría prohibida para el rol -- o un endpoint
 *  caído -- no borre del panel a las otras cuatro. */
function resultados<T>(estado: PromiseSettledResult<PaginatedResponse<T>>): T[] {
  return estado.status === 'fulfilled' ? estado.value.results : []
}

/** Página vacía para la categoría que el rol no puede consultar. Evita el
 *  `if` en cada rama y deja que todas devuelvan la misma forma. */
function vacia<T>(): Promise<PaginatedResponse<T>> {
  return Promise.resolve({
    count: 0,
    page: 1,
    page_size: 0,
    total_pages: 0,
    next: null,
    previous: null,
    results: [] as T[],
  })
}

export async function searchEverything(
  term: string,
  scope: SearchScope,
  signal?: AbortSignal,
): Promise<SearchGroup[]> {
  const params = { search: term, page_size: POR_CATEGORIA }

  const [stays, rooms, reservations, folios] = await Promise.allSettled([
    scope.stays
      ? get<PaginatedResponse<StayListItem>>('/frontdesk/stays/', {
          params: { ...params, status: 'ACTIVE' },
          signal,
        })
      : vacia<StayListItem>(),
    scope.rooms
      ? get<PaginatedResponse<Room>>('/frontdesk/rooms/', { params, signal })
      : vacia<Room>(),
    scope.reservations
      ? get<PaginatedResponse<Reservation>>('/frontdesk/reservations/', {
          params: { ...params, ordering: '-scheduled_start' },
          signal,
        })
      : vacia<Reservation>(),
    scope.folios
      ? get<PaginatedResponse<Folio>>('/sales/folios/', { params, signal })
      : vacia<Folio>(),
  ])

  const rentas = resultados(stays)
  const cuartos = resultados(rooms)
  const reservas = resultados(reservations)
  const cuentas = resultados(folios)

  const grupos: SearchGroup[] = [
    {
      kind: 'stay',
      label: 'Rentas activas',
      hits: rentas.map((stay) => ({
        key: `stay-${stay.id}`,
        kind: 'stay' as const,
        title: `Habitación ${stay.room_number}`,
        subtitle: [stay.guest_name, stay.vehicle_plate].filter(Boolean).join(' · ') || stay.code,
        stayId: stay.id,
      })),
    },
    {
      kind: 'room',
      label: 'Habitaciones',
      hits: cuartos.map((room) => ({
        key: `room-${room.id}`,
        kind: 'room' as const,
        title: `Habitación ${room.number}`,
        subtitle: [room.room_type_name, room.zone].filter(Boolean).join(' · '),
        badge: ESTADO_HABITACION[room.status] ?? room.status_display,
        roomNumber: room.number,
      })),
    },
    {
      kind: 'reservation',
      label: 'Reservaciones',
      hits: reservas.map((reservation) => ({
        key: `reservation-${reservation.id}`,
        kind: 'reservation' as const,
        title: reservation.guest_name || reservation.code,
        subtitle: [
          reservation.code,
          reservation.room_number ? `Hab. ${reservation.room_number}` : reservation.room_type_name,
          reservation.vehicle_plate,
        ]
          .filter(Boolean)
          .join(' · '),
        badge: reservation.status_display,
        query: reservation.code,
      })),
    },
    { kind: 'guest', label: 'Huéspedes', hits: huespedes(term, rentas, reservas) },
    {
      kind: 'folio',
      label: 'Folios',
      hits: cuentas.map((folio) => ({
        key: `folio-${folio.id}`,
        kind: 'folio' as const,
        title: folio.code,
        subtitle: folio.room_number ? `Habitación ${folio.room_number}` : 'Mostrador',
        badge: folio.status_display,
        stayId: folio.stay ?? undefined,
      })),
    },
  ]

  return grupos.filter((grupo) => grupo.hits.length > 0)
}

/** No hay padrón de clientes: el nombre del huésped es un campo suelto en la
 *  renta y en la reservación. Esta categoría agrupa por nombre lo que ya vino
 *  en las dos listas anteriores, así que no cuesta ninguna petición más.
 *
 *  Solo entran los nombres que de verdad contienen lo buscado: una renta pudo
 *  haber coincidido por placa o por folio, y colgarla de "Huéspedes" haría ver
 *  un nombre que no tiene nada que ver con lo que se escribió. */
function huespedes(
  term: string,
  rentas: StayListItem[],
  reservas: Reservation[],
): SearchHit[] {
  const buscado = normalizar(term)
  const porNombre = new Map<string, { nombre: string; visitas: number; stayId?: number }>()

  const agregar = (nombre: string, stayId?: number): void => {
    if (!nombre.trim() || !normalizar(nombre).includes(buscado)) return
    const clave = normalizar(nombre)
    const previo = porNombre.get(clave)
    if (previo) {
      previo.visitas += 1
      previo.stayId = previo.stayId ?? stayId
      return
    }
    porNombre.set(clave, { nombre: nombre.trim(), visitas: 1, stayId })
  }

  rentas.forEach((stay) => agregar(stay.guest_name, stay.id))
  reservas.forEach((reservation) => agregar(reservation.guest_name))

  return [...porNombre.values()].map((huesped) => ({
    key: `guest-${normalizar(huesped.nombre)}`,
    kind: 'guest' as const,
    title: huesped.nombre,
    subtitle:
      huesped.visitas > 1 ? `${huesped.visitas} coincidencias` : 'Una coincidencia',
    stayId: huesped.stayId,
    query: huesped.nombre,
  }))
}
