import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

/** El escaparate que se opera, no la fotografía del hero.
 *
 *  El hero enseña el mismo tablero encendido como demostración, y está dentro
 *  de un `aria-hidden` justo porque es decorativo. Todas las consultas de estas
 *  pruebas se acotan aquí: lo que se verifica es lo que el visitante recorre,
 *  no la vitrina. */
function escaparate(): HTMLElement {
  const grids = [...document.querySelectorAll<HTMLElement>('.grid-cols-4')]
  const grid = grids.find((nodo) => !nodo.closest('[aria-hidden="true"]')) ?? grids.at(-1)
  const seccion = grid?.closest('section')
  if (!seccion) throw new Error('no se encontró el escaparate')
  return seccion
}

/** Estados de las ocho habitaciones, leídos del color de cada tarjeta. */
function tablero(): string[] {
  const grids = [...escaparate().querySelectorAll('.grid-cols-4')]
  const grid = grids[0]
  return [...(grid?.children ?? [])].map((tarjeta) => {
    const clases = tarjeta.className
    // Se lee el token semántico, no el nombre del color. La maqueta usa los
    // mismos que el producto (`status-available`, `brand-accent`,
    // `status-cleaning`), así que un negocio con su propia paleta cambia los
    // colores sin cambiar lo que estas pruebas verifican: el estado.
    if (clases.includes('status-available')) return 'libre'
    if (clases.includes('brand-accent')) return 'ocupada'
    if (clases.includes('status-cleaning')) return 'limpieza'
    return 'apagada'
  })
}

function contar(estado: string): number {
  return tablero().filter((valor) => valor === estado).length
}

function folioVisible(): boolean {
  const panel = within(escaparate()).getByText('Folio · Hab. 201').closest('[aria-hidden]')
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
    expect(within(escaparate()).queryByText('100%')).not.toBeInTheDocument()
  })

  it('paso 1 enciende el tablero en verde', () => {
    pintar()
    verPaso(0)

    expect(contar('libre')).toBe(8)
    expect(within(escaparate()).getByText('100%')).toBeInTheDocument()
  })

  it('paso 2 ocupa tres habitaciones y enciende sus huéspedes', () => {
    pintar()
    verPaso(1)

    expect(contar('ocupada')).toBe(3)
    expect(contar('libre')).toBe(5)
    // 2 + 2 + 1 huéspedes en las tres ocupadas.
    expect(within(escaparate()).getByText('14:30')).toBeInTheDocument()
    expect(within(escaparate()).getByText('38%')).toBeInTheDocument()
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
    expect(within(escaparate()).getByText('25%')).toBeInTheDocument()
    expect(within(escaparate()).getByText('13%')).toBeInTheDocument()
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

/** Radix activa la pestaña en `mousedown`, no en `click`: un `click` suelto
 *  la deja donde estaba. Se reproduce el toque completo. */
function tocarPestana(nombre: RegExp): void {
  const pestana = screen.getByRole('tab', { name: nombre })
  fireEvent.mouseDown(pestana)
  fireEvent.click(pestana)
}

/** Deja `useMediaQuery` contestando que la pantalla es angosta. */
function fingirPantallaAngosta(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('max-width: 1023px'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

describe('escaparate en pantalla angosta', () => {
  beforeEach(() => {
    observados = []
    fingirPantallaAngosta()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no depende del desplazamiento: no observa nada', () => {
    // El recorrido por scroll con panel pegajoso es justo lo que se rompía en
    // el teléfono. Aquí no debe existir.
    pintar()

    expect(observados).toHaveLength(0)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
  })

  it('la maqueta y el texto del paso conviven en pantalla', () => {
    pintar()

    const maqueta = document.querySelector('.grid-cols-4')
    const panel = screen.getByRole('tabpanel')

    expect(maqueta).toBeInTheDocument()
    expect(panel).toBeInTheDocument()
    if (!maqueta) throw new Error('sin maqueta')
    // La maqueta va antes que el texto en el documento: se lee con la
    // habitación a la vista, no después de haberla perdido.
    expect(maqueta.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('arranca en el primer paso, no apagada', () => {
    // Sin desplazamiento que la encienda, esperar a un evento dejaría la
    // maqueta en gris para siempre.
    pintar()

    expect(contar('libre')).toBe(8)
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(/Alta/)
  })

  it('tocar un paso enciende su estado en la maqueta', () => {
    pintar()

    tocarPestana(/Ocupación/)
    expect(contar('ocupada')).toBe(3)

    tocarPestana(/Consumo/)
    expect(folioVisible()).toBe(true)

    tocarPestana(/Rotación/)
    expect(contar('limpieza')).toBe(1)
    expect(folioVisible()).toBe(false)
  })

  it('el texto que se muestra es el del paso elegido', () => {
    pintar()
    tocarPestana(/Rotación/)

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Rotación y control de limpieza',
    )
  })
})
