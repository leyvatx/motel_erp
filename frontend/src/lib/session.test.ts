import { beforeEach, describe, expect, it } from 'vitest'

import { queryClient, queryKeys } from '@/lib/queryClient'
import { cerrarSesionLocal } from '@/lib/session'
import { useAuthStore } from '@/store/auth'
import type { LoginResponse } from '@/types/api'

function sesion(): LoginResponse {
  return {
    access: 'acceso',
    refresh: 'renovacion',
    user: {
      id: 1,
      username: 'rocio',
      full_name: 'Rocío Estrada',
      email: 'rocio@rioverde.mx',
      role: 'SUPERADMIN',
      motel: 4,
      motel_name: 'Motel Río Verde',
      motel_slug: 'motel-rio-verde',
    },
  } as unknown as LoginResponse
}

describe('cerrar sesión en esta terminal', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(sesion())
    localStorage.setItem('erp-tema-resuelto', '{"vars":{"--brand-accent":"293 69% 49%"}}')
    localStorage.setItem('erp-ui', '{"state":{"soundAlerts":false}}')
    queryClient.setQueryData(queryKeys.settings.business, { name: 'Motel Río Verde' })
  })

  // El defecto: quedaba el nombre del negocio y su color en pantalla después de
  // salir. `clear()` conservaba `motelSlug`, y con esa pista la consulta pública
  // de la marca volvía a pedir el mismo motel en cuanto se vaciaba la caché.
  it('no deja ni la pista de a qué negocio se había entrado', () => {
    cerrarSesionLocal()

    const estado = useAuthStore.getState()
    expect(estado.access).toBeNull()
    expect(estado.refresh).toBeNull()
    expect(estado.user).toBeNull()
    expect(estado.motelSlug).toBeNull()
    expect(estado.activeMotelId).toBeNull()
    expect(estado.activeMotelName).toBeNull()
  })

  // El tema resuelto lo aplica un guion que corre antes que React: mientras
  // siguiera guardado, el color del motel volvía en la siguiente carga.
  it('vacía el almacenamiento del navegador, tema pre-pintado incluido', () => {
    cerrarSesionLocal()

    expect(localStorage.getItem('erp-tema-resuelto')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('tira la caché de consultas, donde vivía el perfil del negocio', () => {
    cerrarSesionLocal()

    expect(queryClient.getQueryData(queryKeys.settings.business)).toBeUndefined()
  })
})

describe('la purga no deja que el store vuelva a escribir', () => {
  // El defecto que describe el reporte: `localStorage.clear()` borra la clave,
  // pero el middleware `persist` conserva su copia en memoria y la reescribe en
  // el siguiente `set()`. Sin `clearStorage()`, la sesión reaparecía sola.
  it('suelta también la copia del middleware, no solo la clave', () => {
    useAuthStore.getState().setSession(sesion())
    expect(localStorage.getItem('erp-auth')).not.toBeNull()

    cerrarSesionLocal()

    // Un `set()` posterior -- lo que hace React al repintar tras salir -- no
    // puede resucitar la sucursal anterior.
    useAuthStore.setState({ activeMotelName: null })

    const guardado = localStorage.getItem('erp-auth')
    expect(guardado === null || !guardado.includes('motel-rio-verde')).toBe(true)
    expect(useAuthStore.getState().motelSlug).toBeNull()
  })
})
