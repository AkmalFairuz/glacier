import { create } from 'zustand'

export type Toast = { id: number; kind: 'error' | 'success' | 'info'; message: string }

const DURATION_MS = 4500
let next = 1

export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }))

export function dismissToast(id: number) {
  useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

function push(kind: Toast['kind'], message: string) {
  const { toasts } = useToasts.getState()
  if (toasts.some((t) => t.message === message)) return
  const id = next++
  useToasts.setState({ toasts: [...toasts.slice(-3), { id, kind, message }] })
  window.setTimeout(() => dismissToast(id), DURATION_MS)
}

/** Transient notices, in place of window.alert. */
export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  info: (message: string) => push('info', message),
}
