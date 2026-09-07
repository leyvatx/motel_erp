import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin `globals: true` en vitest.config, testing-library no engancha su propio
// afterEach: sin esto el DOM de una prueba sigue montado en la siguiente y las
// consultas encuentran elementos duplicados.
afterEach(cleanup)
