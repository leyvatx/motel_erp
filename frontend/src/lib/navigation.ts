/** Navegación desde fuera de React.
 *
 *  El interceptor de axios necesita sacar al usuario cuando la sesión murió de
 *  verdad, y ahí no hay componente ni hook del cual colgarse. Hacerlo con
 *  `window.location` funciona, pero recarga la aplicación entera: pantalla en
 *  blanco, todo el bundle otra vez y la caché de consultas desde cero.
 *
 *  El router se registra al crearse y este módulo queda como el punto por el
 *  que pasa cualquier navegación de fuera del árbol. El respaldo a
 *  `window.location` se conserva para el caso en que algo navegue antes de que
 *  el router exista: es feo, pero es mejor que quedarse donde no se puede
 *  estar.
 */

type Navegador = (ruta: string) => void

let navegador: Navegador | null = null

export function registrarNavegador(fn: Navegador): void {
  navegador = fn
}

export function navegarA(ruta: string): void {
  if (navegador) {
    navegador(ruta)
    return
  }
  window.location.assign(ruta)
}
