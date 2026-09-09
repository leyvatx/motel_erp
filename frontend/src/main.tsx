import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
// Antes que cualquier componente: `useTranslation` necesita la instancia ya
// arrancada, y arrancarla dentro de un efecto deja el primer render en las
// claves crudas.
import '@/lib/i18n'
import '@/index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('No se encontro el nodo #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
