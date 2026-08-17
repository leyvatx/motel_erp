import { syncServerTime } from '@/lib/serverTime'
import { authSnapshot } from '@/store/auth'
import type { ConnectionState, RealtimeMessage } from '@/types/realtime'

type MessageHandler = (message: RealtimeMessage) => void
type StateHandler = (state: ConnectionState) => void

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 30_000

function resolveWsUrl(path: string): string {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) return `${configured}${path}`

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${path}`
}

export class RealtimeChannel {
  private socket: WebSocket | null = null
  private readonly messageHandlers = new Set<MessageHandler>()
  private readonly stateHandlers = new Set<StateHandler>()
  private reconnectAttempts = 0
  private pingTimer: number | null = null
  private reconnectTimer: number | null = null
  private manuallyClosed = false
  private state: ConnectionState = 'idle'

  constructor(private readonly path: string) {}

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const token = authSnapshot.access()
    if (!token) {
      this.setState('closed')
      return
    }

    this.manuallyClosed = false
    this.setState('connecting')

    const socket = new WebSocket(`${resolveWsUrl(this.path)}?token=${encodeURIComponent(token)}`)
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
      }
    }

    socket.onerror = () => {
      this.setState('error')
    }

    socket.onclose = (event: CloseEvent) => {
      this.stopPing()
      this.setState('closed')

      if (this.manuallyClosed || event.code === 4401) return
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.manuallyClosed = true
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
