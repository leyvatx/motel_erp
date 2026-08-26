import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

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
  } catch {
    useAuthStore.getState().clear()
    return null
  }
}

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

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true

      refreshPromise = refreshPromise ?? refreshAccessToken()
      const access = await refreshPromise
      refreshPromise = null

      if (access) {
        original.headers.set('Authorization', `Bearer ${access}`)
        return api.request(original)
      }

      if (window.location.pathname !== '/login') {
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
