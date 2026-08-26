import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveWsUrl } from '@/lib/websocket'

function conEnv(vars: Record<string, string | undefined>) {
  for (const [clave, valor] of Object.entries(vars)) {
    vi.stubEnv(clave, valor as string)
  }
}

afterEach(() => vi.unstubAllEnvs())

describe('a qué host se conecta el WebSocket', () => {
  it('usa VITE_WS_URL cuando está configurada', () => {
    conEnv({ VITE_WS_URL: 'wss://api.ejemplo.com', VITE_API_URL: 'https://otra.com' })
    expect(resolveWsUrl('/ws/ops/')).toBe('wss://api.ejemplo.com/ws/ops/')
  })

  it('le pone wss:// a una VITE_WS_URL que venga como host pelón', () => {
    conEnv({ VITE_WS_URL: 'api.ejemplo.com', VITE_API_URL: undefined })
    expect(resolveWsUrl('/ws/ops/')).toBe('wss://api.ejemplo.com/ws/ops/')
  })

  it('sin VITE_WS_URL cae al host de la API, no al de la página', () => {
    // Este es el caso que dejaba "Reconectando" para siempre en producción: el
    // frontend es un sitio estático y no tiene servidor de WebSocket.
    conEnv({ VITE_WS_URL: undefined, VITE_API_URL: 'https://motel-erp-api.onrender.com' })
    expect(resolveWsUrl('/ws/ops/')).toBe('wss://motel-erp-api.onrender.com/ws/ops/')
  })

  it('respeta http:// del desarrollo local y no fuerza TLS', () => {
    conEnv({ VITE_WS_URL: undefined, VITE_API_URL: 'http://localhost:8000' })
    expect(resolveWsUrl('/ws/ops/')).toBe('ws://localhost:8000/ws/ops/')
  })

  it('no deja doble diagonal cuando la API trae barra al final', () => {
    conEnv({ VITE_WS_URL: undefined, VITE_API_URL: 'https://api.ejemplo.com/' })
    expect(resolveWsUrl('/ws/ops/')).toBe('wss://api.ejemplo.com/ws/ops/')
  })
})
