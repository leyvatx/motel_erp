import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSetupStatus } from '@/features/onboarding/hooks'
import { useAuthStore } from '@/store/auth'
import type { Role, User } from '@/types/api'

vi.mock('@/features/config/api', () => ({
  businessApi: {
    profile: vi.fn(),
    public: vi.fn(),
    update: vi.fn(),
    updateLogo: vi.fn(),
    timeZones: vi.fn(),
  },
  configApi: {},
}))

vi.mock('@/features/frontdesk/api', () => ({
  frontdeskApi: { roomTypes: vi.fn(), tariffBlocks: vi.fn(), rooms: vi.fn() },
}))

const { businessApi } = await import('@/features/config/api')
const { frontdeskApi } = await import('@/features/frontdesk/api')

function user(role: Role): User {
  return {
    id: 1,
    username: 'prueba',
    full_name: 'Usuario Prueba',
    email: '',
    phone: '',
    role,
    role_display: role,
    motel: 1,
    motel_name: 'Sucursal Prueba',
    motel_slug: 'sucursal-prueba',
    is_platform_admin: false,
    is_corporate_user: false,
    employee_number: '',
    hired_at: null,
    is_active: true,
    is_staff: false,
    must_change_password: false,
    last_login: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function pagina(count: number) {
  return { count, next: null, previous: null, results: [] }
}

function envoltura({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function conDatos({
  nombre,
  tipos,
  tarifas,
  habitaciones,
  logo = null,
}: {
  nombre: string
  tipos: number
  tarifas: number
  habitaciones: number
  logo?: string | null
}) {
  vi.mocked(businessApi.profile).mockResolvedValue({ name: nombre, logo_url: logo } as never)
  vi.mocked(frontdeskApi.roomTypes).mockResolvedValue(pagina(tipos) as never)
  vi.mocked(frontdeskApi.tariffBlocks).mockResolvedValue(pagina(tarifas) as never)
  vi.mocked(frontdeskApi.rooms).mockResolvedValue(pagina(habitaciones) as never)
}

describe('estado de configuración inicial', () => {
  beforeEach(() => {
    useAuthStore.setState({ access: 'token', user: user('MANAGER'), activeMotelId: null })
  })

  it('marca los cuatro pasos pendientes en una sucursal recién creada', async () => {
    conDatos({ nombre: 'Mi negocio', tipos: 0, tarifas: 0, habitaciones: 0 })

    const { result } = renderHook(() => useSetupStatus(), { wrapper: envoltura })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pending.map((step) => step.id)).toEqual([
      'business',
      'roomType',
      'tariff',
      'rooms',
    ])
    expect(result.current.complete).toBe(false)
  })

  // La lista dice qué falta para poder rentar. Sin logotipo se renta igual, así
  // que pedirlo dejaría el aviso puesto para siempre en un negocio ya operando.
  it('un nombre propio sin logotipo ya deja hecho el paso del negocio', async () => {
    conDatos({ nombre: 'Cabañas del Lago', tipos: 0, tarifas: 0, habitaciones: 0 })

    const { result } = renderHook(() => useSetupStatus(), { wrapper: envoltura })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pending.map((step) => step.id)).toEqual(['roomType', 'tariff', 'rooms'])
  })

  it('con nombre propio y logotipo, el paso del negocio queda hecho', async () => {
    conDatos({
      nombre: 'Cabañas del Lago',
      logo: '/media/branding/lago.png',
      tipos: 0,
      tarifas: 0,
      habitaciones: 0,
    })

    const { result } = renderHook(() => useSetupStatus(), { wrapper: envoltura })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pending.map((step) => step.id)).toEqual(['roomType', 'tariff', 'rooms'])
  })

  it('se declara completo cuando ya hay identidad, tipo, tarifa y habitaciones', async () => {
    conDatos({
      nombre: 'Cabañas del Lago',
      logo: '/media/branding/lago.png',
      tipos: 2,
      tarifas: 3,
      habitaciones: 19,
    })

    const { result } = renderHook(() => useSetupStatus(), { wrapper: envoltura })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.complete).toBe(true)
    expect(result.current.pending).toEqual([])
  })

  it('no aplica ni consulta nada para quien no puede configurar', async () => {
    conDatos({ nombre: 'Mi negocio', tipos: 0, tarifas: 0, habitaciones: 0 })
    useAuthStore.setState({ access: 'token', user: user('RECEPTION') })

    const { result } = renderHook(() => useSetupStatus(), { wrapper: envoltura })

    await waitFor(() => expect(result.current.applies).toBe(false))
    expect(result.current.loading).toBe(false)
    expect(frontdeskApi.roomTypes).not.toHaveBeenCalled()
    expect(frontdeskApi.tariffBlocks).not.toHaveBeenCalled()
    expect(frontdeskApi.rooms).not.toHaveBeenCalled()
  })
})
