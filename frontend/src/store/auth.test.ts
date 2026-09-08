import { describe, expect, it } from 'vitest'

import { canAccessSection, defaultRouteFor, useAuthStore } from '@/store/auth'
import type { Role, User } from '@/types/api'

function user(role: Role, platform = false): User {
  return {
    id: 1,
    username: 'prueba',
    full_name: 'Usuario Prueba',
    email: '',
    phone: '',
    role,
    role_display: role,
    motel: platform ? null : 1,
    motel_name: platform ? null : 'Motel Prueba',
    motel_slug: platform ? null : 'motel-prueba',
    is_platform_admin: platform,
    is_corporate_user: false,
    employee_number: '',
    hired_at: null,
    is_active: true,
    is_staff: platform,
    must_change_password: false,
    last_login: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('acceso por rol', () => {
  // Entrar y ya estar en la herramienta: recepción no viene a leer un resumen,
  // viene a rentar cuartos, y ama de llaves viene a ver su lista.
  it('deja a cada rol en su herramienta, no en un resumen', () => {
    expect(defaultRouteFor(user('RECEPTION'))).toBe('/frontdesk')
    expect(defaultRouteFor(user('HOUSEKEEPING'))).toBe('/housekeeping')
    expect(defaultRouteFor(user('MANAGER'))).toBe('/dashboard')
  })

  it('mantiene al administrador global fuera de la operación', () => {
    const platform = user('SUPERADMIN', true)
    expect(defaultRouteFor(platform)).toBe('/platform')
    expect(canAccessSection(platform, 'frontdesk')).toBe(false)
    expect(canAccessSection(platform, 'platform')).toBe(true)
  })

  it('no muestra reportes ni auditoría a recepción', () => {
    const reception = user('RECEPTION')
    expect(canAccessSection(reception, 'reports')).toBe(false)
    expect(canAccessSection(reception, 'audit')).toBe(false)
    expect(canAccessSection(reception, 'reservations')).toBe(true)
  })

  it('mantiene al usuario corporativo en el panel hasta seleccionar una sucursal', () => {
    const corporate = {
      ...user('MANAGER'),
      motel: null,
      motel_name: null,
      motel_slug: null,
      is_corporate_user: true,
    }
    useAuthStore.getState().clearActiveMotel()
    expect(defaultRouteFor(corporate)).toBe('/corporate')
    expect(canAccessSection(corporate, 'corporate')).toBe(true)
    expect(canAccessSection(corporate, 'dashboard')).toBe(false)
    useAuthStore.getState().setActiveMotel(8, 'Sucursal Norte', 'MANAGER')
    expect(canAccessSection(corporate, 'dashboard')).toBe(true)
    // Ya dentro de una sucursal, el corporativo aterriza como el rol que ejerce.
    expect(defaultRouteFor(corporate)).toBe('/dashboard')
    useAuthStore.getState().setActiveMotel(8, 'Sucursal Norte', 'RECEPTION')
    expect(defaultRouteFor(corporate)).toBe('/frontdesk')
    useAuthStore.getState().clearActiveMotel()
  })
})
