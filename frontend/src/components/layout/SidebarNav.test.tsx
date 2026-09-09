import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { SidebarNav } from '@/components/layout/SidebarNav'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import type { Role, User } from '@/types/api'

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

function pintar(role: Role, ruta = '/dashboard') {
  useAuthStore.setState({ user: user(role) })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SidebarNav expanded />
    </MemoryRouter>,
  )
}

describe('barra lateral por rol', () => {
  beforeEach(() => {
    useUiStore.setState({ navGroups: { management: false } })
  })

  it('a recepción solo le muestra la operación diaria', () => {
    pintar('RECEPTION')

    expect(screen.getByText('Operación')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Recepción/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Caja/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Inventarios/ })).toBeInTheDocument()

    expect(screen.queryByText('Gestión')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Configuración/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Auditoría/ })).not.toBeInTheDocument()
  })

  it('a ama de llaves no le ofrece reservaciones ni caja', () => {
    pintar('HOUSEKEEPING')

    expect(screen.getByRole('link', { name: /Ama de llaves/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reservaciones/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Caja/ })).not.toBeInTheDocument()
  })

  it('a gerencia le muestra Gestión cerrada, y la abre al pulsarla', () => {
    pintar('MANAGER')

    const grupo = screen.getByRole('button', { name: /Gestión/ })
    expect(grupo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /Configuración/ })).not.toBeInTheDocument()

    fireEvent.click(grupo)

    expect(grupo).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Configuración/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reportes/ })).toBeInTheDocument()
  })

  it('abre Gestión sola cuando ya estás dentro de una de sus pantallas', () => {
    pintar('MANAGER', '/reports')

    expect(screen.getByRole('button', { name: /Gestión/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Reportes/ })).toBeInTheDocument()
  })

  it('despliega las secciones de Configuración solo cuando estás en ella', () => {
    const { unmount } = pintar('SUPERADMIN', '/reports')
    expect(screen.queryByRole('link', { name: 'Tarifas' })).not.toBeInTheDocument()
    unmount()

    pintar('SUPERADMIN', '/config')
    const tarifas = screen.getByRole('link', { name: 'Tarifas' })
    expect(tarifas).toHaveAttribute('href', '/config?seccion=tarifas')
  })

  it('marca la sección abierta dentro del submenú de Configuración', () => {
    pintar('SUPERADMIN', '/config?seccion=apariencia')

    const submenu = screen.getByRole('link', { name: 'Apariencia' })
    expect(submenu).toHaveClass('font-medium')
    expect(
      within(screen.getByRole('navigation')).getByRole('link', { name: 'Negocio' }),
    ).toBeInTheDocument()
  })
})
