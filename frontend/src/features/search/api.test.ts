import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/axios', () => ({ get: vi.fn() }))

const { get } = await import('@/lib/axios')
const { searchEverything } = await import('@/features/search/api')

const TODO = { stays: true, rooms: true, reservations: true, folios: true }

function pagina(results: unknown[]) {
  return { count: results.length, page: 1, page_size: 5, total_pages: 1, next: null, previous: null, results }
}

function responder(por: Record<string, unknown[] | Error>) {
  vi.mocked(get).mockImplementation((url: string) => {
    const clave = Object.keys(por).find((parte) => url.includes(parte))
    const valor = clave ? por[clave] : []
    if (valor instanceof Error) return Promise.reject(valor)
    return Promise.resolve(pagina(valor ?? []) as never)
  })
}

const RENTA = {
  id: 7,
  code: 'R-1',
  room: 3,
  room_number: '101',
  status: 'ACTIVE',
  check_in_at: '',
  expires_at: '',
  remaining_seconds: 0,
  vehicle_plate: 'ABC-123',
  guest_name: 'Juan Pérez',
}

const CUARTO = {
  id: 3,
  number: '101',
  room_type: 1,
  room_type_name: 'Jacuzzi',
  status: 'AVAILABLE',
  status_display: 'Disponible',
  floor: 1,
  zone: 'Norte',
  has_garage: true,
  notes: '',
  status_changed_at: '',
  out_of_service_reason: '',
  is_active: true,
}

describe('buscador global', () => {
  beforeEach(() => {
    vi.mocked(get).mockReset()
  })

  it('arma un grupo por tipo y descarta los vacíos', async () => {
    responder({ '/frontdesk/stays/': [RENTA], '/frontdesk/rooms/': [CUARTO] })

    const grupos = await searchEverything('101', TODO)

    expect(grupos.map((grupo) => grupo.kind)).toEqual(['stay', 'room'])
    expect(grupos[0]?.hits[0]).toMatchObject({
      title: 'Habitación 101',
      subtitle: 'Juan Pérez · ABC-123',
      stayId: 7,
    })
    expect(grupos[1]?.hits[0]).toMatchObject({
      title: 'Habitación 101',
      subtitle: 'Jacuzzi · Norte',
      badge: 'Disponible',
      roomNumber: '101',
    })
  })

  it('no cuelga de Huéspedes a quien coincidió por placa y no por nombre', async () => {
    responder({ '/frontdesk/stays/': [RENTA] })

    const porPlaca = await searchEverything('ABC', TODO)
    expect(porPlaca.find((grupo) => grupo.kind === 'guest')).toBeUndefined()

    const porNombre = await searchEverything('juan', TODO)
    expect(porNombre.find((grupo) => grupo.kind === 'guest')?.hits[0]).toMatchObject({
      title: 'Juan Pérez',
      subtitle: 'Una coincidencia',
      stayId: 7,
    })
  })

  it('junta al mismo huésped de la renta y de la reservación', async () => {
    responder({
      '/frontdesk/stays/': [RENTA],
      '/frontdesk/reservations/': [
        {
          id: 9,
          code: 'RS-2',
          room: null,
          room_number: null,
          room_type: 1,
          room_type_name: 'Jacuzzi',
          status: 'CONFIRMED',
          status_display: 'Confirmada',
          guest_name: 'JUAN PEREZ',
          vehicle_plate: '',
        },
      ],
    })

    const grupos = await searchEverything('juan', TODO)
    const huespedes = grupos.find((grupo) => grupo.kind === 'guest')

    expect(huespedes?.hits).toHaveLength(1)
    expect(huespedes?.hits[0]).toMatchObject({ title: 'Juan Pérez', subtitle: '2 coincidencias' })
  })

  it('una categoría que falla no se lleva a las demás', async () => {
    responder({
      '/frontdesk/rooms/': [CUARTO],
      '/sales/folios/': new Error('403'),
    })

    const grupos = await searchEverything('101', TODO)

    expect(grupos.map((grupo) => grupo.kind)).toEqual(['room'])
  })

  it('no pide lo que el rol no puede ver', async () => {
    responder({ '/frontdesk/rooms/': [CUARTO] })

    await searchEverything('101', {
      stays: true,
      rooms: true,
      reservations: false,
      folios: false,
    })

    const urls = vi.mocked(get).mock.calls.map(([url]) => url)
    expect(urls).toContain('/frontdesk/rooms/')
    expect(urls).toContain('/frontdesk/stays/')
    expect(urls).not.toContain('/frontdesk/reservations/')
    expect(urls).not.toContain('/sales/folios/')
  })

  it('encadena la señal de aborto a cada petición', async () => {
    responder({ '/frontdesk/rooms/': [CUARTO] })
    const control = new AbortController()

    await searchEverything('101', TODO, control.signal)

    for (const [, config] of vi.mocked(get).mock.calls) {
      expect(config?.signal).toBe(control.signal)
    }
  })
})
