import { afterEach, describe, expect, it, vi } from 'vitest'

import { RealtimeChannel, resolveWsUrl } from '@/lib/websocket'
import { authSnapshot } from '@/store/auth'
import type { ConnectionState } from '@/types/realtime'

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

describe('cuando el navegador ni siquiera deja abrir el socket', () => {
  // El caso real de producción: `ws://` en una página `https://` es contenido
  // mixto y el constructor de WebSocket lanza en el acto. La excepción se
  // escapaba por la promesa interna, nadie programaba el reintento y el canal
  // se quedaba diciendo "Reconectando" para siempre, sin volver a intentarlo
  // jamás. Ahora se atrapa, se reintenta un número acotado de veces y se
  // acepta que aquí no hay tiempo real.
  it('se rinde y lo dice, en vez de quedarse conectando para siempre', async () => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
    vi.spyOn(authSnapshot, 'access').mockReturnValue('token-de-prueba')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ticket: 't', expires_in: 30 }) }),
    )
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new DOMException('mixed content', 'SecurityError')
        }
      },
    )

    const canal = new RealtimeChannel('/ws/ops/')
    const estados: ConnectionState[] = []
    canal.onStateChange((estado) => estados.push(estado))

    canal.connect()
    // Cada vuelta: se resuelve el ticket (microtareas) y vence la espera del
    // reintento (temporizadores). Con margen de sobra para las seis.
    for (let vuelta = 0; vuelta < 12; vuelta += 1) {
      await vi.advanceTimersByTimeAsync(60_000)
    }

    expect(canal.getState()).toBe('degradado')
    expect(estados).toContain('error')

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})

describe('contenido mixto', () => {
  it('sube a wss:// una configuración ws:// cuando la página va por https', () => {
    vi.stubGlobal('location', { ...window.location, protocol: 'https:' })
    conEnv({ VITE_WS_URL: 'ws://api.ejemplo.com', VITE_API_URL: undefined })

    // Dejarlo en ws:// no es "que falle": es que el navegador ni siquiera
    // intenta, lanza al construir, y el canal se queda mudo.
    expect(resolveWsUrl('/ws/ops/')).toBe('wss://api.ejemplo.com/ws/ops/')

    vi.unstubAllGlobals()
  })

  it('no toca ws:// en desarrollo local, que va por http', () => {
    vi.stubGlobal('location', { ...window.location, protocol: 'http:' })
    conEnv({ VITE_WS_URL: undefined, VITE_API_URL: 'http://localhost:8000' })

    expect(resolveWsUrl('/ws/ops/')).toBe('ws://localhost:8000/ws/ops/')

    vi.unstubAllGlobals()
  })
})
