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
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), {
      target: { value: 'Motel Tunsur' },
    })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Efrain Leyva' } })
    fireEvent.change(correo(), { target: { value: 'efrainleyva240@gmail.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }))

    expect(await screen.findByText('Esta contraseña es muy común.')).toBeInTheDocument()
  })
})
