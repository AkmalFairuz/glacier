import type { ReactNode } from 'react'
import { create } from 'zustand'

export type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive. */
  danger?: boolean
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

/** `pending` outlives `open` so the dialog keeps its text while fading out. */
export const useConfirmStore = create<{ open: boolean; pending: Pending | null }>(() => ({ open: false, pending: null }))

/** Asks the user to confirm, in place of window.confirm. Resolves false on cancel/Esc. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const { open, pending } = useConfirmStore.getState()
  if (open) pending?.resolve(false)
  return new Promise((resolve) => useConfirmStore.setState({ open: true, pending: { ...options, resolve } }))
}

export function settleConfirm(ok: boolean) {
  const { open, pending } = useConfirmStore.getState()
  if (!open) return
  pending?.resolve(ok)
  useConfirmStore.setState({ open: false })
}
