import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LandingPage from '@/features/marketing/LandingPage'

/* jsdom no trae IntersectionObserver, así que se sustituye por uno que guarda
 * lo observado y deja disparar la entrada a voluntad. De paso es la única forma
 * de probar esto: en un navegador sin pintar -- headless, pestaña oculta -- el
 * observador real tampoco emite. */
type Callback = (entradas: { target: Element; isIntersecting: boolean }[]) => void

let observados: Element[] = []
let disparar: Callback = () => undefined
let desconectado = false

class ObservadorFalso {
  constructor(callback: Callback) {
    disparar = callback
  }
  observe(elemento: Element) {
    observados.push(elemento)
  }
  unobserve() {}
  disconnect() {
    desconectado = true
  }
  takeRecords() {
    return []
  }
}

/** Lo que entrega el observador cuando un paso queda centrado: ese cruza la
 *  banda y los demás dejan de cruzarla. */
function verPaso(indice: number): void {
  act(() => {
    disparar(observados.map((target, i) => ({ target, isIntersecting: i === indice })))
  })
}

/** El límite entre dos pasos contiguos: los dos cruzan la banda a la vez. */
function verLimite(arriba: number, abajo: number): void {
  act(() => {
    disparar(
      observados.map((target, i) => ({
        target,
        isIntersecting: i === arriba || i === abajo,
      })),
    )
  })
}

/** Estados de las ocho habitaciones, leídos del color de cada tarjeta. */
function tablero(): string[] {
  const grid = document.querySelector('.grid-cols-4')
  return [...(grid?.children ?? [])].map((tarjeta) => {
    const clases = tarjeta.className
    if (clases.includes('emerald')) return 'libre'
    if (clases.includes('indigo')) return 'ocupada'
    if (clases.includes('amber')) return 'limpieza'
    return 'apagada'
  })
}

function contar(estado: string): number {
  return tablero().filter((valor) => valor === estado).length
}

function folioVisible(): boolean {
  const panel = screen.getByText('Folio · Hab. 201').closest('[aria-hidden]')
  return panel?.getAttribute('aria-hidden') === 'false'
}

function pintar() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('escaparate de la landing', () => {
  beforeEach(() => {
    observados = []
    desconectado = false
    vi.stubGlobal('IntersectionObserver', ObservadorFalso)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('observa los cuatro pasos y suelta el observador al desmontar', () => {
    const { unmount } = pintar()

    expect(observados).toHaveLength(4)
    unmount()
    expect(desconectado).toBe(true)
  })

  it('arranca apagado: la retícula en gris, sin métricas', () => {
    pintar()

    expect(contar('apagada')).toBe(8)
    // Sin encender no hay porcentajes que enseñar.
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('paso 1 enciende el tablero en verde', () => {
    pintar()
    verPaso(0)

    expect(contar('libre')).toBe(8)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('paso 2 ocupa tres habitaciones y enciende sus huéspedes', () => {
    pintar()
    verPaso(1)

    expect(contar('ocupada')).toBe(3)
    expect(contar('libre')).toBe(5)
    // 2 + 2 + 1 huéspedes en las tres ocupadas.
    expect(screen.getByText('14:30')).toBeInTheDocument()
    expect(screen.getByText('38%')).toBeInTheDocument()
  })

  it('paso 3 despliega el folio sin mover el tablero', () => {
    pintar()
    verPaso(1)
    const antes = tablero()

    verPaso(2)

    expect(folioVisible()).toBe(true)
    expect(tablero()).toEqual(antes)
  })

  it('paso 4 manda una a limpieza y recalcula los porcentajes', () => {
    pintar()
    verPaso(3)

    expect(contar('limpieza')).toBe(1)
    expect(contar('ocupada')).toBe(2)
    expect(folioVisible()).toBe(false)
    // 2 de 8 ocupadas, 1 de 8 por limpiar.
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('13%')).toBeInTheDocument()
  })

  it('en el límite entre dos pasos no parpadea: manda el de arriba', () => {
    // Los dos cruzan la banda central. Sin una regla, el tablero saltaría entre
    // ambos según el orden en que el navegador reporte las entradas.
    pintar()
    verPaso(1)
    verLimite(1, 2)

    expect(folioVisible()).toBe(false)
    expect(contar('ocupada')).toBe(3)

    // El relevo ocurre cuando el de arriba termina de salirse de la banda.
    verPaso(2)
    expect(folioVisible()).toBe(true)
  })

  it('salir de la sección no apaga el tablero', () => {
    pintar()
    verPaso(3)
    act(() => {
      disparar(observados.map((target) => ({ target, isIntersecting: false })))
    })

    expect(contar('limpieza')).toBe(1)
    expect(contar('apagada')).toBe(0)
  })

  it('no nombra el tipo de negocio en ningún texto visible', () => {
    // Restricción de marca blanca: la landing es del producto, no de un giro.
    pintar()

    expect(document.body.textContent?.toLowerCase()).not.toContain('motel')
  })

  it('deja a la vista las dos puertas de entrada', () => {
    pintar()

    expect(screen.getAllByRole('link', { name: /crear cuenta/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /entrar/i }).length).toBeGreaterThan(0)
  })
})
