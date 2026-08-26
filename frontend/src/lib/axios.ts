import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { useToastStore } from '@/components/ui/toast'
import { syncServerTime } from '@/lib/serverTime'
import { authSnapshot, useAuthStore } from '@/store/auth'
import type { ApiErrorBody, TokenPair } from '@/types/api'

function absolute(value: string | undefined): string {
  if (!value) return ''
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

const BASE_URL = absolute(import.meta.env.VITE_API_URL)

// El plan free de Render duerme el servicio a los 15 min y retiene la primera
// petición mientras el contenedor vuelve a levantarse. Con 20 s se cortaba
// justo ahí: el login moría por tiempo de espera en vez de esperar el arranque,
// y como los mutations no reintentan, parecía que la API no respondía nunca.
// Bájalo a 20 s el día que la API deje de dormirse.
const TIMEOUT_MS = 60000

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: TIMEOUT_MS,
})

const plain: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: TIMEOUT_MS,
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
  _intentos?: number
}

const REINTENTOS_MAX = 3

/** Los devuelve el proxy de Render, no Django: el contenedor no estaba arriba. */
const NUNCA_LLEGO = new Set([502, 503, 504])

const IDEMPOTENTES = new Set(['get', 'head', 'options'])

export function pareceDormido(error: AxiosError): boolean {
  const status = error.response?.status
  if (status !== undefined && NUNCA_LLEGO.has(status)) return true
  return !error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK')
}

export function sePuedeRepetir(error: AxiosError): boolean {
  const status = error.response?.status

  // Un 502/503/504 lo contesta el proxy porque no encontró a quién preguntarle:
  // la petición nunca tocó Django, así que repetirla no puede duplicar nada.
  if (status !== undefined && NUNCA_LLEGO.has(status)) return true

  // Aquí no hubo respuesta, y "sin respuesta" no es "sin procesar": el servidor
  // pudo haber cerrado el folio y habérsenos perdido el regreso. Repetir un
  // POST a ciegas cobra dos veces o renta el mismo cuarto dos veces, así que
  // solo se repite lo que no cambia nada. Un cobro fallido lo reintenta el
  // recepcionista, que sí sabe si el cargo entró.
  const metodo = (error.config?.method ?? 'get').toLowerCase()
  return IDEMPOTENTES.has(metodo)
}

/** 1 s, 2 s, 4 s. El pellizco al azar evita que las seis consultas del grid
 *  vuelvan todas juntas y le caigan encima al contenedor que apenas despierta. */
function esperar(intento: number): Promise<void> {
  const ms = 1000 * 2 ** (intento - 1) + Math.random() * 400
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Un solo aviso para todas las peticiones que estén esperando a la vez, con
// cuenta de referencias: el grid dispara varias y seis avisos iguales apilados
// son peor que ninguno.
let esperando = 0
let avisoId: number | null = null

function abrirAviso(): void {
  esperando += 1
  if (avisoId !== null) return
  avisoId = useToastStore.getState().push({
    title: 'Despertando servidores',
    description: 'Esto puede tomar unos segundos.',
    variant: 'info',
    // Se quita solo si algo sale mal con la cuenta; lo normal es que lo cierre
    // cerrarAviso en cuanto la última petición se resuelva.
    durationMs: 120000,
  })
}

function cerrarAviso(): void {
  esperando = Math.max(0, esperando - 1)
  if (esperando > 0 || avisoId === null) return
  useToastStore.getState().dismiss(avisoId)
  avisoId = null
}

/** Devuelve la respuesta buena si el reintento sirvió, o null si esto no era
 *  un servidor dormido. Si se acabaron los intentos, propaga el error. */
async function reintentarSiDuerme(
  instancia: AxiosInstance,
  error: AxiosError,
): Promise<AxiosResponse | null> {
  const original = error.config as RetriableConfig | undefined
  if (!original || !pareceDormido(error) || !sePuedeRepetir(error)) return null

  const intento = (original._intentos ?? 0) + 1
  if (intento > REINTENTOS_MAX) return null
  original._intentos = intento

  abrirAviso()
  try {
    await esperar(intento)
    return await instancia.request(original)
  } finally {
    cerrarAviso()
  }
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = authSnapshot.refresh()
  if (!refresh) return null

  try {
    const { data } = await plain.post<TokenPair>('/auth/refresh/', { refresh })
    useAuthStore.getState().setAccess(data.access)
    if (data.refresh) {
      useAuthStore.setState({ refresh: data.refresh })
    }
    return data.access
  } catch (error) {
    // Solo se cierra la sesión cuando el servidor de verdad rechazó el token.
    // Un 502 del proxy o un timeout no dicen nada sobre él, y tirar la sesión
    // ahí significa que cada vez que el contenedor duerme, todo el turno de
    // recepción amanece en la pantalla de login.
    const rechazado = axios.isAxiosError(error) && (error.response?.status ?? 0) < 500
    if (rechazado) useAuthStore.getState().clear()
    return null
  }
}

// El refresh también tiene que aguantar el arranque: si se rinde, el usuario
// acaba fuera aunque su sesión estuviera perfectamente viva.
plain.interceptors.response.use(undefined, async (error: AxiosError) => {
  const reintento = await reintentarSiDuerme(plain, error)
  if (reintento) return reintento
  return Promise.reject(error)
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = authSnapshot.access()
  if (access) {
    config.headers.set('Authorization', `Bearer ${access}`)
  }
  const activeMotelId = authSnapshot.activeMotelId()
  if (activeMotelId) config.headers.set('X-Motel-Id', String(activeMotelId))
  return config
})

api.interceptors.response.use(
  (response) => {
    const serverDate = response.headers['date']
    if (typeof serverDate === 'string') syncServerTime(serverDate)
    return response
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined

    const reintento = await reintentarSiDuerme(api, error)
    if (reintento) return reintento

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true

      refreshPromise = refreshPromise ?? refreshAccessToken()
      const access = await refreshPromise
      refreshPromise = null

      if (access) {
        original.headers.set('Authorization', `Bearer ${access}`)
        return api.request(original)
      }

      // clear() es lo único que borra el refresh: si sigue ahí, la sesión no
      // terminó, solo no se pudo renovar ahora. El error se propaga y la vista
      // lo muestra en vez de sacar al usuario a media captura.
      if (!authSnapshot.refresh() && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback = 'Ocurrio un error inesperado.'): string {
  if (!axios.isAxiosError(error)) return fallback

  const body = error.response?.data as ApiErrorBody | undefined
  const message = body?.error?.message
  if (typeof message === 'string') return message

  if (message && typeof message === 'object') {
    const first = Object.values(message)[0]
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  }

  if (error.code === 'ECONNABORTED') return 'El servidor tardo demasiado en responder.'
  if (!error.response) return 'Sin conexión con el servidor.'
  return fallback
}

export function apiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  return (error.response?.data as ApiErrorBody | undefined)?.error?.code ?? null
}

export async function get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
  const { data } = await api.get<TResponse>(url, config)
  return data
}

export async function post<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const { data } = await api.post<TResponse>(url, body, config)
  return data
}

export async function patch<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const { data } = await api.patch<TResponse>(url, body, config)
  return data
}

export async function put<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
): Promise<TResponse> {
  const { data } = await api.put<TResponse>(url, body)
  return data
}

export async function del<TResponse = void>(url: string): Promise<TResponse> {
  const { data } = await api.delete<TResponse>(url)
  return data
}
