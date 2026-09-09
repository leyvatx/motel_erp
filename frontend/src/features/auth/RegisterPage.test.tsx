import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mutate = vi.fn()

vi.mock('@/features/auth/hooks', () => ({
  useSignup: () => ({ mutate, isPending: false, isError: false, error: null }),
}))

// La página lee la marca del negocio para el título de la pestaña; eso pasa por
// react-query y sin cliente ni siquiera monta.
vi.mock('@/features/config/api', () => ({
  businessApi: {
    profile: vi.fn().mockResolvedValue({ name: 'Prueba' }),
    public: vi.fn().mockResolvedValue({ name: 'Prueba' }),
  },
  configApi: {},
}))

const { useAuthStore } = await import('@/store/auth')
const { default: RegisterPage } = await import('@/features/auth/RegisterPage')

function pintar() {
  useAuthStore.setState({ access: null, user: null })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function correo(): HTMLInputElement {
  return screen.getByLabelText('Correo') as HTMLInputElement
}

function usuario(): HTMLInputElement {
  return screen.getByLabelText('Nombre de usuario') as HTMLInputElement
}

/** Deja el formulario listo para enviar, con todo lo que el alta exige. */
function llenarTodo(): void {
  fireEvent.change(screen.getByLabelText('Nombre del negocio'), {
    target: { value: 'Motel Tunsur' },
  })
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Efrain Leyva' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '667 220 1188' } })
  fireEvent.change(correo(), { target: { value: 'efrainleyva240@gmail.com' } })
  fireEvent.click(screen.getByLabelText('11-30'))
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '12345678' } })
}

describe('formulario de registro', () => {
  beforeEach(() => {
    mutate.mockReset()
  })

  it('sugiere dominios mientras el correo esté a medias', () => {
    pintar()
    expect(screen.queryByRole('button', { name: /@gmail\.com/ })).not.toBeInTheDocument()

    fireEvent.change(correo(), { target: { value: 'efrainleyva240' } })

    expect(
      screen.getByRole('button', { name: /Completar como efrainleyva240@gmail\.com/ }),
    ).toBeInTheDocument()
  })

  it('un clic completa el correo y las sugerencias se retiran', async () => {
    pintar()
    fireEvent.change(correo(), { target: { value: 'efrainleyva240' } })
    fireEvent.click(screen.getByRole('button', { name: /Completar como .*@gmail\.com/ }))

    await waitFor(() => expect(correo().value).toBe('efrainleyva240@gmail.com'))
    expect(screen.queryByRole('button', { name: /Completar como/ })).not.toBeInTheDocument()
  })

  it('con el dominio ya escrito no estorba con sugerencias', () => {
    pintar()
    fireEvent.change(correo(), { target: { value: 'alguien@sudominio.mx' } })

    expect(screen.queryByRole('button', { name: /Completar como/ })).not.toBeInTheDocument()
  })

  it('el ojo alterna entre ver y ocultar la contraseña', () => {
    pintar()
    const clave = screen.getByLabelText('Contraseña') as HTMLInputElement
    expect(clave.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(clave.type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(clave.type).toBe('password')
  })

  it('pinta bajo su campo la razón que devolvió la API', async () => {
    // El caso real: un 400 traía la razón en error.details y el formulario
    // enseñaba "Los datos enviados no son válidos", que no dice cuál falló.
    mutate.mockImplementation((_valores, opciones) =>
      opciones.onError({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'invalid',
              message: 'Los datos enviados no son válidos.',
              details: { password: ['Esta contraseña es muy común.'] },
            },
          },
        },
      }),
    )

    pintar()
    llenarTodo()
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    expect(await screen.findByText('Esta contraseña es muy común.')).toBeInTheDocument()
  })

  // El servidor derivaba la clave del correo y la persona la descubria despues.
  // Ahora se propone a la vista, editable, y deja de proponerse en cuanto la
  // tocan: una sugerencia que se reimpone sobre lo tecleado no es una ayuda.
  it('propone el usuario a partir del correo mientras nadie lo toque', async () => {
    pintar()
    fireEvent.change(correo(), { target: { value: 'laura.dominguez@laspalmas.mx' } })

    await waitFor(() => expect(usuario().value).toBe('laura.dominguez'))

    fireEvent.change(usuario(), { target: { value: 'lau' } })
    fireEvent.change(correo(), { target: { value: 'otra@laspalmas.mx' } })

    await waitFor(() => expect(correo().value).toBe('otra@laspalmas.mx'))
    expect(usuario().value).toBe('lau')
  })

  it('no deja pasar un usuario con caracteres que el servidor va a rechazar', async () => {
    pintar()
    llenarTodo()
    fireEvent.change(usuario(), { target: { value: 'Laura Dominguez' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    expect(
      await screen.findByText('Solo minúsculas, números, punto, guion y guion bajo.'),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('exige un teléfono al que se pueda marcar', async () => {
    pintar()
    llenarTodo()
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '667' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    expect(await screen.findByText('Escribe el teléfono con lada.')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('manda el tamaño de la operación con el alta', async () => {
    pintar()
    llenarTodo()
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      username: 'efrainleyva240',
      phone: '667 220 1188',
      operation_size: '11-30',
    })
  })
})
