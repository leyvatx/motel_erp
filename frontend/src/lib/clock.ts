import { serverNow } from '@/lib/serverTime'

/** Un solo latido para todos los cronómetros de la pantalla.
 *
 *  El tablero de recepción puede tener cuarenta tarjetas a la vista y cada una
 *  necesita su cuenta regresiva. Con un `setInterval` por tarjeta son cuarenta
 *  temporizadores despertando al navegador cada segundo, cuarenta renders
 *  sueltos y cuarenta desfases de milisegundos entre relojes que deberían decir
 *  lo mismo.
 *
 *  Aquí hay un temporizador y muchos suscriptores. La hora sigue saliendo de
 *  `serverNow()` -- la del servidor, corregida por el desfase del equipo -- que
 *  es la que decide cuánto se cobra; esto solo cambia quién la pregunta.
 *
 *  El intervalo se apaga cuando el último suscriptor se va: una pestaña en
 *  Caja no tiene por qué seguir latiendo. */
const suscriptores = new Set<() => void>()

let temporizador: number | null = null
let instante = serverNow()

function latir(): void {
  instante = serverNow()
  for (const avisar of suscriptores) avisar()
}

export function suscribirReloj(alCambiar: () => void): () => void {
  if (suscriptores.size === 0) instante = serverNow()
  suscriptores.add(alCambiar)

  temporizador ??= window.setInterval(latir, 1000)

  return () => {
    suscriptores.delete(alCambiar)
    if (suscriptores.size > 0 || temporizador === null) return
    window.clearInterval(temporizador)
    temporizador = null
  }
}

/** Instante del último latido. Estable dentro del mismo segundo, que es lo que
 *  `useSyncExternalStore` exige para no re-renderizar en bucle. */
export function instanteActual(): number {
  return instante
}
