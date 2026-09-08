/** Despertar el servidor antes de pedirle algo que no se puede repetir.
 *
 *  El plan gratuito de Render apaga el contenedor a los quince minutos y lo
 *  vuelve a levantar con la primera petición, que se queda esperando entre
 *  treinta y cincuenta segundos. Para lo que se puede reintentar sin
 *  consecuencias -- una consulta -- eso ya lo absorbe el interceptor de axios.
 *
 *  El alta de una organización no entra en ese grupo: es un POST, repetirlo a
 *  ciegas puede crear dos negocios, y por eso `sePuedeRepetir` lo excluye a
 *  propósito. El resultado era que quien se registraba con el servicio dormido
 *  recibía un error de red y se quedaba sin cuenta, sin entender por qué.
 *
 *  Aquí se invierte el orden: primero se toca la puerta con una petición que sí
 *  es segura de repetir, y sólo cuando contesta se manda el alta. La espera pasa
 *  de ser un error a ser una pantalla que explica qué está ocurriendo.
 */
const RUTA_SALUD = '/api/health'

/** Cuánto se está dispuesto a esperar en total. Un arranque en frío de Render
 *  ronda los 30-50 s; con 90 se cubre el caso malo sin dejar a nadie mirando
 *  una pantalla para siempre. */
const PRESUPUESTO_MS = 90_000

/** Cada intento tiene su propio corte: si el contenedor está arrancando, la
 *  conexión se queda abierta sin contestar y hay que soltarla para reintentar. */
const CORTE_POR_INTENTO_MS = 10_000

/** Creciente y con techo: los primeros intentos son rápidos por si el servidor
 *  ya estaba despierto, y luego se espacian para no castigar a un contenedor
 *  que está arrancando. */
function esperaDelIntento(intento: number): number {
  return Math.min(1000 * intento, 5000)
}

function baseUrl(): string {
  const configurada = import.meta.env.VITE_API_URL
  if (!configurada) return ''
  return /^https?:\/\//.test(configurada) ? configurada : `https://${configurada}`
}

export interface ProgresoDespertar {
  intento: number
  /** Milisegundos transcurridos desde que se empezó a tocar la puerta. */
  transcurrido: number
}

export interface OpcionesDespertar {
  /** Se llama en cada intento fallido, para que la pantalla cuente algo real. */
  onIntento?: (progreso: ProgresoDespertar) => void
  señal?: AbortSignal
}

/** Toca la puerta hasta que el servidor contesta.
 *
 *  Devuelve `true` en cuanto responde y `false` si se agota el presupuesto o
 *  alguien cancela. No lanza: quien llama decide qué hacer con un `false`, y
 *  tratar "no despertó" como excepción obliga a envolver cada uso en un try.
 */
export async function despertarServidor({
  onIntento,
  señal,
}: OpcionesDespertar = {}): Promise<boolean> {
  const arranque = Date.now()
  let intento = 0

  while (Date.now() - arranque < PRESUPUESTO_MS) {
    if (señal?.aborted) return false
    intento += 1

    const corte = new AbortController()
    const alarma = setTimeout(() => corte.abort(), CORTE_POR_INTENTO_MS)
    // Cancelar desde fuera tiene que cortar también la petición en vuelo.
    const propagar = (): void => corte.abort()
    señal?.addEventListener('abort', propagar)

    try {
      const respuesta = await fetch(`${baseUrl()}${RUTA_SALUD}`, {
        method: 'GET',
        signal: corte.signal,
        // La sonda no lleva credenciales ni las necesita: sólo pregunta si el
        // proceso está en pie.
        cache: 'no-store',
      })
      if (respuesta.ok) return true
    } catch {
      // Sin respuesta todavía. No es un fallo: es exactamente lo que se espera
      // de un contenedor que está arrancando.
    } finally {
      clearTimeout(alarma)
      señal?.removeEventListener('abort', propagar)
    }

    if (señal?.aborted) return false
    onIntento?.({ intento, transcurrido: Date.now() - arranque })
    await new Promise((listo) => setTimeout(listo, esperaDelIntento(intento)))
  }

  return false
}
