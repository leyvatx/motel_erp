import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'

import { pareceDormido, sePuedeRepetir } from '@/lib/axios'

function fallo(
  metodo: string,
  { status, code }: { status?: number; code?: string } = {},
): AxiosError {
  const config = { method: metodo, headers: {} } as InternalAxiosRequestConfig
  const error = new AxiosError('falla', code, config)
  if (status !== undefined) {
    error.response = { status, data: {}, statusText: '', headers: {}, config }
  }
  return error
}

describe('detección del servidor dormido', () => {
  it('reconoce lo que devuelve el proxy cuando no hay contenedor', () => {
    expect(pareceDormido(fallo('get', { status: 502 }))).toBe(true)
    expect(pareceDormido(fallo('get', { status: 503 }))).toBe(true)
    expect(pareceDormido(fallo('get', { status: 504 }))).toBe(true)
  })

  it('reconoce el timeout y la red caída', () => {
    expect(pareceDormido(fallo('get', { code: 'ECONNABORTED' }))).toBe(true)
    expect(pareceDormido(fallo('get', { code: 'ERR_NETWORK' }))).toBe(true)
  })

  it('no confunde un error de verdad con un servidor dormido', () => {
    expect(pareceDormido(fallo('get', { status: 500 }))).toBe(false)
    expect(pareceDormido(fallo('get', { status: 404 }))).toBe(false)
    expect(pareceDormido(fallo('post', { status: 400 }))).toBe(false)
  })
})

describe('qué se puede repetir sin cobrar dos veces', () => {
  it('repite cualquier verbo cuando la petición no llegó a Django', () => {
    // El proxy contestó por él: nada se procesó, repetir es gratis.
    expect(sePuedeRepetir(fallo('post', { status: 502 }))).toBe(true)
    expect(sePuedeRepetir(fallo('patch', { status: 503 }))).toBe(true)
  })

  it('repite lecturas que se quedaron sin respuesta', () => {
    expect(sePuedeRepetir(fallo('get', { code: 'ECONNABORTED' }))).toBe(true)
    expect(sePuedeRepetir(fallo('head', { code: 'ERR_NETWORK' }))).toBe(true)
  })

  it('NO repite escrituras que se quedaron sin respuesta', () => {
    // Este es el caso que puede cobrar dos veces: el checkout pudo haberse
    // procesado y habérsenos perdido el regreso. Sin respuesta no es sin cobrar.
    expect(sePuedeRepetir(fallo('post', { code: 'ECONNABORTED' }))).toBe(false)
    expect(sePuedeRepetir(fallo('post', { code: 'ERR_NETWORK' }))).toBe(false)
    expect(sePuedeRepetir(fallo('patch', { code: 'ECONNABORTED' }))).toBe(false)
    expect(sePuedeRepetir(fallo('delete', { code: 'ECONNABORTED' }))).toBe(false)
  })
})
