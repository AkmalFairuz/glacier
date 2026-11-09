import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './api-schema'
import { toast } from '../ui/toast'

const RATE_LIMITED = 'You’re doing that too fast. Try again in a moment.'

const TOKEN_KEY = 'glacier.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let unauthorizedHandler: (() => void) | null = null

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

const auth: Middleware = {
  onRequest({ request }) {
    const token = tokenStore.get()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  async onResponse({ request, response }) {
    if (response.ok) return response
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: { code?: string; message?: string } } | null
    if (response.status === 401 && request.headers.has('Authorization')) unauthorizedHandler?.()
    if (response.status === 429) toast.error(RATE_LIMITED)
    throw new ApiError(response.status, body?.error?.code ?? 'internal', body?.error?.message ?? response.statusText)
  },
}

export const client = createClient<paths>({ baseUrl: '' })
client.use(auth)

/** Resolves an openapi-fetch call to its success payload (errors already threw in middleware). */
export async function unwrap<R extends { data?: unknown }>(call: Promise<R>): Promise<Exclude<R['data'], undefined>> {
  const { data } = await call
  return data as Exclude<R['data'], undefined>
}

/** Multipart body: openapi-fetch passes FormData through untouched. */
export function fileBody(file: File): never {
  const form = new FormData()
  form.append('file', file)
  return form as never
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return RATE_LIMITED
  if (error instanceof TypeError) return 'Cannot reach Glacier. Check your connection.'
  // Server messages are lowercase sentences; show them capitalized like the rest of the UI.
  if (error instanceof Error) return error.message.charAt(0).toUpperCase() + error.message.slice(1)
  return 'Something went wrong'
}
