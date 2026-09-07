import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/auth'
import type { User } from '@/types/api'

const PERFIL: User = {
  id: 1,
  username: 'recepcion',
  full_name: 'Ana Recepción',
  email: '',
  phone: '',
  role: 'RECEPTION',
  role_display: 'Recepción',
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

function pintar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/frontdesk']}>
        <Routes>
          <Route path="/login" element={<p>Pantalla de acceso</p>} />
          <Route
            path="/frontdesk"
            element={
              <ProtectedRoute section="frontdesk">
                <p>Tablero de recepción</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('puerta de sesión', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, access: null, refresh: null, activeMotelId: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('manda al acceso cuando no hay token', () => {
    pintar()
    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument()
  })

  // La regresión que esto vigila: `/auth/me` se pedía desde `AppLayout`, que
  // esta misma puerta no montaba mientras faltara el perfil. Token sin perfil
  // se quedaba en "Validando..." para siempre. Si alguien vuelve a mover la
  // consulta fuera de aquí, esta prueba se queda esperando y falla.
  it('con token pero sin perfil pide /auth/me y entra al resolverse', async () => {
    const me = vi.spyOn(authApi, 'me').mockResolvedValue(PERFIL)
    useAuthStore.setState({ access: 'token-vivo' })

    pintar()

    expect(screen.getByText('Validando la sesión')).toBeInTheDocument()
    await waitFor(() => expect(me).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Tablero de recepción')).toBeInTheDocument()
  })

  it('si el perfil no llega ofrece una salida en vez de esperar sin fin', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('sin red'))
    useAuthStore.setState({ access: 'token-vivo' })

    pintar()

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir y entrar de nuevo' })).toBeInTheDocument()
  })

  it('sin permiso de sección no entra', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ ...PERFIL, role: 'HOUSEKEEPING' })
    useAuthStore.setState({ access: 'token-vivo' })

    pintar()

    await waitFor(() => expect(screen.queryByText('Tablero de recepción')).not.toBeInTheDocument())
  })
})
