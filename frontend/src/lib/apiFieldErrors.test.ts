import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { apiFieldErrors } from '@/lib/axios'

/** Respuesta tal como la arma api/common/exceptions.py ante un 400 de DRF. */
function error400(details: Record<string, unknown>): AxiosError {
  const fallo = new AxiosError('Request failed with status code 400')
  fallo.response = {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      error: {
        code: 'invalid',
        message: 'Los datos enviados no son válidos.',
        details,
      },
    },
  }
  return fallo
}

describe('errores por campo de la API', () => {
  it('saca la razón real de details, no el texto fijo de message', () => {
    const campos = apiFieldErrors(
      error400({ email: ['Introduzca una dirección de correo electrónico válida.'] }),
    )

    expect(campos).toEqual({
      email: 'Introduzca una dirección de correo electrónico válida.',
    })
  })

  it('junta las razones cuando un campo falla por más de una', () => {
    // Es el caso real del registro: arreglar solo la primera no alcanza.
    const campos = apiFieldErrors(
      error400({
        password: ['Esta contraseña es muy común.', 'Esta contraseña es totalmente numérica.'],
      }),
    )

    expect(campos.password).toBe(
      'Esta contraseña es muy común. Esta contraseña es totalmente numérica.',
    )
  })

  it('devuelve todos los campos que fallaron, no solo el primero', () => {
    const campos = apiFieldErrors(
      error400({
        business_name: ['Este campo no puede estar en blanco.'],
        password: ['Muy corta.'],
      }),
    )

    expect(Object.keys(campos).sort()).toEqual(['business_name', 'password'])
  })

  it('sin details no inventa campos', () => {
    expect(apiFieldErrors(error400({}))).toEqual({})
    expect(apiFieldErrors(new Error('sin red'))).toEqual({})
  })
})
