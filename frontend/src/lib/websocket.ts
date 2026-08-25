import { api } from '@/lib/axios'
import { syncServerTime } from '@/lib/serverTime'
import { authSnapshot } from '@/store/auth'
import type { ConnectionState, RealtimeMessage } from '@/types/realtime'

type MessageHandler = (message: RealtimeMessage) => void
type StateHandler = (state: ConnectionState) => void

interface WsTicket {
  ticket: string
  expires_in: number
}

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 30_000

function resolveWsUrl(path: string): string {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) return `${configured}${path}`

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${path}`
}

async function requestTicket(): Promise<string> {
  const { data } = await api.post<WsTicket>('/auth/ws-ticket/')
  return data.ticket
}

export class RealtimeChannel {
  private socket: WebSocket | null = null
  private readonly messageHandlers = new Set<MessageHandler>()
  private readonly stateHandlers = new Set<StateHandler>()
  private reconnectAttempts = 0
  private pingTimer: number | null = null
  private reconnectTimer: number | null = null
  private manuallyClosed = false
  private connectPending = false
  private generation = 0
  private state: ConnectionState = 'idle'

  constructor(private readonly path: string) {}

  connect(): void {
    if (this.connectPending) return
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

    const socket = new WebSocket(`${resolveWsUrl(this.path)}?ticket=${encodeURIComponent(ticket)}`)
    this.socket = socket

    socket.onopen = () => {
      this.reconnectAttempts = 0
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

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1
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
