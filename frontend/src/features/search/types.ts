export type SearchKind = 'stay' | 'room' | 'reservation' | 'guest' | 'folio'

export interface SearchHit {
  /** Único en toda la lista: la navegación por teclado se apoya en él. */
  key: string
  kind: SearchKind
  title: string
  subtitle?: string
  badge?: string
  stayId?: number
  roomNumber?: string
  query?: string
}

export interface SearchGroup {
  kind: SearchKind
  label: string
  hits: SearchHit[]
}

export interface SearchScope {
  stays: boolean
  rooms: boolean
  reservations: boolean
  folios: boolean
}
