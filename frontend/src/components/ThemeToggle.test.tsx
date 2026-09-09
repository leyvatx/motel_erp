import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ThemeToggle } from '@/components/ThemeToggle'
import { CLAVE_MODO, useAppearanceStore } from '@/store/appearance'

describe('claro y oscuro, con o sin sesión', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.removeItem(CLAVE_MODO)
    useAppearanceStore.setState({ theme: 'business' })
  })

  // El defecto que arregla: el botón miraba la *preferencia*, no la pantalla.
  // Con `business` -- que es el valor de fábrica -- el primer toque ponía
  // `dark` estuviera ya oscuro o no, así que en una sucursal configurada en
  // oscuro el primer toque no hacía nada visible.
  it('ofrece lo contrario de lo que se está viendo, no de lo que se prefirió', () => {
    document.documentElement.classList.add('dark')

    render(<ThemeToggle />)

    expect(screen.getByLabelText('Cambiar a tema claro')).toBeInTheDocument()
  })

  it('guarda la elección aparte de la marca del negocio', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByLabelText('Cambiar a tema oscuro'))

    // `erp-modo` es lo que lee el guion que corre antes que React. Que se
    // escriba en el mismo clic es lo que evita el parpadeo de la recarga.
    expect(localStorage.getItem(CLAVE_MODO)).toBe('dark')
    expect(useAppearanceStore.getState().theme).toBe('dark')
  })

  // La preferencia vive en este navegador, no en el perfil: un visitante sin
  // cuenta la cambia igual que un empleado con sesión abierta.
  it('no toca la sesión para nada', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByLabelText('Cambiar a tema oscuro'))

    expect(localStorage.getItem('erp-auth')).toBeNull()
  })
})
