import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { useAuthStore } from '@/store/auth'
import type { Role, User } from '@/types/api'

function usuario(role: Role, extra: Partial<User> = {}): User {
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
    ...extra,
  }
}

function pintar(user: User | null) {
  useAuthStore.setState({ user, activeMotelId: null, activeRole: null })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <MobileTabBar onOpenMenu={() => undefined} />
    </MemoryRouter>,
  )
}

describe('barra inferior de operación', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, activeMotelId: null, activeRole: null })
  })

  it('recepción lleva sus destinos diarios al pulgar', () => {
    pintar(usuario('RECEPTION'))

    expect(screen.getByRole('link', { name: 'Recepción' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Caja' })).toBeInTheDocument()
    // Gestión no baja: no es operación diaria y no cabe.
    expect(screen.queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument()
  })

  // Cuatro etiquetas caben enteras en 320 px; a cinco empiezan a partirse.
  it('no baja más de cuatro destinos y siempre deja la salida al resto', () => {
    pintar(usuario('RECEPTION'))

    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Ver todas las secciones' })).toBeInTheDocument()
  })

  it('el botón Más abre el menú completo', () => {
    const abrir = vi.fn()
    useAuthStore.setState({ user: usuario('RECEPTION') })
    render(
      <MemoryRouter initialEntries={['/frontdesk']}>
        <MobileTabBar onOpenMenu={abrir} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las secciones' }))
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('ama de llaves solo ve lo suyo, nunca secciones sin permiso', () => {
    pintar(usuario('HOUSEKEEPING'))

    expect(screen.getByRole('link', { name: 'Ama de llaves' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Caja' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Recepción' })).not.toBeInTheDocument()
  })

  // La barra es una jerarquía de mostrador: imponérsela a quien administra la
  // plataforma sería prestarle la navegación de otro rol.
  it('no se le impone a un administrador de plataforma', () => {
    const { container } = pintar(usuario('SUPERADMIN', { is_platform_admin: true }))
    expect(container).toBeEmptyDOMElement()
  })

  it('sin sesión resuelta no pinta nada', () => {
    const { container } = pintar(null)
    expect(container).toBeEmptyDOMElement()
  })
})
