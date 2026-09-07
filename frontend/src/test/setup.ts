import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin `globals: true` en vitest.config, testing-library no engancha su propio
// afterEach: sin esto el DOM de una prueba sigue montado en la siguiente y las
// consultas encuentran elementos duplicados.
afterEach(cleanup)

// jsdom no implementa matchMedia y cualquier componente que consulte el tamaño
// de pantalla revienta al montarse. Por omisión no coincide ninguna consulta,
// que equivale a escritorio; una prueba que necesite otro tamaño lo sustituye
// con `vi.stubGlobal('matchMedia', ...)`.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
