import { syncServerTime } from '@/lib/serverTime'
import { authSnapshot } from '@/store/auth'
import type { ConnectionState, RealtimeMessage } from '@/types/realtime'
import i18n from '@/lib/i18n'

type MessageHandler = (message: RealtimeMessage) => void
type StateHandler = (state: ConnectionState) => void

interface WsTicket {
  ticket: string
  expires_in: number
}

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 30_000

/** Cuántas veces se insiste antes de aceptar que aquí no hay tiempo real.
 *
 *  Con la espera creciente son unos sesenta segundos. Pasado eso, seguir
 *  intentando cada treinta segundos no arregla nada -- si el servidor de
 *  WebSocket no existe en ese despliegue, no va a aparecer -- y sí cuesta: una
 *  petición de ticket por canal, para siempre, contra una instancia con 0.1 de
 *  CPU. Se para, se avisa, y se vuelve a intentar cuando algo cambie: que
 *  regrese la red o que alguien vuelva a la pestaña. */
const INTENTOS_ANTES_DE_RENDIRSE = 6

/** Cuánto tiene que aguantar abierta una conexión para contar como buena.
 *
 *  El contador de intentos se reiniciaba en cuanto el socket abría. Si el
 *  servidor acepta el saludo y corta enseguida -- un proxy que enruta el
 *  upgrade a algo que no habla WebSocket, o una instancia que se está
 *  reciclando -- el ciclo abrir/cerrar reinicia el contador cada vuelta, nunca
 *  llega al límite y el indicador dice "Reconectando" para siempre. Abrir no
 *  es haber conectado: hay que durar. */
const CONEXION_QUE_CUENTA_MS = 10_000

/** El ticket no puede tardar más que esto. Sin corte, un servidor que acepta la
 *  conexión y no contesta deja al canal esperando sin estado ni reintento. */
const CORTE_DEL_TICKET_MS = 15_000

/** Una página servida por https no puede abrir un socket `ws://`: el navegador
 *  lo bloquea como contenido mixto y el constructor lanza. Si la configuración
 *  viene mal escrita, se corrige aquí en vez de dejar el canal muerto. */
function sinContenidoMixto(url: string): string {
  const paginaSegura = typeof window !== 'undefined' && window.location.protocol === 'https:'
  return paginaSegura && url.startsWith('ws://') ? url.replace(/^ws:\/\//, 'wss://') : url
}

export function resolveWsUrl(path: string): string {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) {
    const base = /^wss?:\/\//.test(configured)
      ? configured
      : `wss://${configured.replace(/^https?:\/\//, '')}`
    return sinContenidoMixto(`${base}${path}`)
  }

  // Sin VITE_WS_URL, el respaldo natural es el host de la API: ahi vive el
  // servidor de WebSocket. Caer al host de la pagina solo funciona en
  // desarrollo, donde Vite hace de proxy; en produccion el frontend es un sitio
  // estatico sin nada que atienda ws://, y el resultado es un "Reconectando"
  // eterno que no delata su causa.
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const protocol = apiUrl.startsWith('http://') ? 'ws://' : 'wss://'
    return sinContenidoMixto(`${protocol}${host}${path}`)
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${path}`
}

/** El ticket de entrada al socket, pedido a mano y no con el cliente de la app.
 *
 *  Antes salía por la instancia de axios que lleva los interceptores de sesión.
 *  Eso ataba el tiempo real a la sesión en la peor dirección: un 401 del ticket
 *  --  y el ticket se pide en cada reintento, o sea sin parar cuando el socket
 *  no levanta -- entraba al mismo camino de renovación que usan las pantallas,
 *  podía consumir el refresh en curso y, si el servidor lo rechazaba, cerraba
 *  la sesión de alguien que estaba trabajando. El tiempo real es un extra:
 *  nunca puede tirar lo que sí funciona.
 *
 *  Va por `fetch` a propósito: mismo token, cero interceptores, y un fallo aquí
 *  no es más que un ticket que no se pudo pedir. */
async function requestTicket(): Promise<string> {
  const access = authSnapshot.access()
  if (!access) throw new Error(i18n.t('comun.sinSesion'))

  const corte = new AbortController()
  const alarma = setTimeout(() => corte.abort(), CORTE_DEL_TICKET_MS)
  try {
    const respuesta = await fetch(`${baseHttpUrl()}/api/v1/auth/ws-ticket/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      signal: corte.signal,
    })
    if (!respuesta.ok) throw new Error(`ticket ${respuesta.status}`)
    const data = (await respuesta.json()) as WsTicket
    return data.ticket
  } finally {
    clearTimeout(alarma)
  }
}

/** El mismo origen al que apunta el cliente HTTP, sin importarlo. */
function baseHttpUrl(): string {
  const configurada = import.meta.env.VITE_API_URL
  if (!configurada) return ''
  const absoluta = /^https?:\/\//.test(configurada) ? configurada : `https://${configurada}`
  return absoluta.replace(/\/+$/, '')
}

export class RealtimeChannel {
  private socket: WebSocket | null = null
  private readonly messageHandlers = new Set<MessageHandler>()
  private readonly stateHandlers = new Set<StateHandler>()
  private reconnectAttempts = 0
  private abiertoEn = 0
  private pingTimer: number | null = null
  private reconnectTimer: number | null = null
  private manuallyClosed = false
  private connectPending = false
  private generation = 0
  private state: ConnectionState = 'idle'

  constructor(private readonly path: string) {}

  connect(): void {
    if (this.connectPending) return
    // Rendido se sale solo por `reintentar()`: si no, cualquier re-render que
    // llame a `connect` reanudaría la insistencia que acabamos de parar.
    if (this.state === 'degradado') return
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    if (!authSnapshot.access()) {
      this.setState('closed')
      return
    }

    this.manuallyClosed = false
    this.connectPending = true
    this.setState('connecting')

    const generation = ++this.generation
    void this.openSocket(generation).finally(() => {
      if (generation === this.generation) this.connectPending = false
    })
  }

  private async openSocket(generation: number): Promise<void> {
    let ticket: string
    try {
      ticket = await requestTicket()
    } catch {
      if (generation !== this.generation) return
      this.setState('error')
      if (!this.manuallyClosed) this.scheduleReconnect()
      return
    }

    if (this.manuallyClosed || generation !== this.generation) return

    // El constructor de WebSocket lanza, y lanza sincrónicamente.
    //
    // Pasa con una URL `ws://` en una página servida por `https://` -- el
    // navegador no permite contenido mixto y tira `SecurityError` -- y con los
    // puertos que Chrome tiene vetados. Sin este `try`, la excepción se escapaba
    // por la promesa de `openSocket`, nadie llamaba a `scheduleReconnect` y el
    // canal se quedaba en "conectando" para siempre: ni reintento, ni error, ni
    // manera de que el usuario supiera que eso ya no iba a levantar. Era el
    // "Reconectando" eterno.
    let socket: WebSocket
    try {
      socket = new WebSocket(`${resolveWsUrl(this.path)}?ticket=${encodeURIComponent(ticket)}`)
    } catch {
      this.setState('error')
      if (!this.manuallyClosed) this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      this.abiertoEn = Date.now()
      this.setState('open')
      this.startPing()
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as RealtimeMessage
        if (message.timestamp) syncServerTime(message.timestamp)
        this.messageHandlers.forEach((handler) => handler(message))
      } catch {
        return
      }
    }

    socket.onerror = () => {
      this.setState('error')
    }

    socket.onclose = () => {
      this.stopPing()
      this.setState('closed')

      // La espera vuelve a empezar solo si la conexión sirvió de algo. Un
      // socket que vivió medio segundo no prueba que haya tiempo real: prueba
      // lo contrario, y contarlo como éxito es lo que dejaba el ciclo abierto.
      if (this.abiertoEn && Date.now() - this.abiertoEn >= CONEXION_QUE_CUENTA_MS) {
        this.reconnectAttempts = 0
      }
      this.abiertoEn = 0

      if (this.manuallyClosed || generation !== this.generation) return
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.manuallyClosed = true
    this.connectPending = false
    this.generation += 1
    this.stopPing()
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.setState('idle')
  }

  refresh(): void {
    this.disconnect()
    this.connect()
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler)
    handler(this.state)
    return () => this.stateHandlers.delete(handler)
  }

  getState(): ConnectionState {
    return this.state
  }

  private setState(state: ConnectionState): void {
    this.state = state
    this.stateHandlers.forEach((handler) => handler(state))
  }

  /** Vuelve a intentarlo después de haberse rendido.
   *
   *  La llaman los avisos del navegador -- volvió la red, el usuario volvió a
   *  la pestaña -- y el enlace del indicador de conexión. Sin esto, rendirse
   *  sería definitivo hasta la siguiente recarga. */
  reintentar(): void {
    if (this.state !== 'degradado') return
    this.reconnectAttempts = 0
    this.setState('closed')
    this.connect()
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1

    // Se acabó la insistencia. El canal queda apagado y lo dice; la aplicación
    // sigue funcionando con peticiones normales, que es lo que de verdad
    // sostiene la operación. Reintentar cada treinta segundos para siempre no
    // recupera un servidor de WebSocket que no está en ese despliegue, y sí
    // deja una petición de ticket en marcha por canal, indefinidamente.
    if (this.reconnectAttempts > INTENTOS_ANTES_DE_RENDIRSE) {
      this.setState('degradado')
      return
    }

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), MAX_BACKOFF_MS)
    const jitter = Math.random() * 500

    this.reconnectTimer = window.setTimeout(() => this.connect(), delay + jitter)
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const section = window.location.pathname.split('/').filter(Boolean)[0] ?? ''
        this.socket.send(JSON.stringify({ action: 'ping', section }))
      }
    }, PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

export const frontdeskChannel = new RealtimeChannel('/ws/frontdesk/')
export const notificationChannel = new RealtimeChannel('/ws/notifications/')

export const realtimeChannels = [frontdeskChannel, notificationChannel] as const
