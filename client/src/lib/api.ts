import type { Attachment } from './types'

// The backend runs on the same origin in production (Express serves this app),
// and Vite proxies /api, /uploads and /socket.io to it in development.
export const API_URL = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.message || data.error || res.statusText, res.status)
  return data as T
}

export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const apiPatch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export async function uploadFile(file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  // No Content-Type header: the browser sets the multipart boundary
  const res = await fetch(API_URL + '/api/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + getToken() },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || data.message || res.statusText, res.status)
  return data as Attachment
}

/** Absolute URL for an uploaded file (avatar, attachment, story media). */
export const fileUrl = (url?: string) => (!url ? '' : /^https?:/.test(url) ? url : API_URL + url)

export const MAX_FILE_SIZE = 50 * 1024 * 1024
