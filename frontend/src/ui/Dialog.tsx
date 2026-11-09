import { useEffect, useRef, useState, type ReactNode } from 'react'
import s from './Dialog.module.css'

export type DialogSize = 'sm' | 'md' | 'lg' | 'window'

type Props = {
  open: boolean
  onClose: () => void
  /** Accessible name, unless `labelledBy` points at a visible heading. */
  label?: string
  labelledBy?: string
  size?: DialogSize
  /** Close when the backdrop is clicked. */
  dismissible?: boolean
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
}

/** Longest close transition in Dialog.module.css, plus slack. */
const EXIT_MS = 220

/**
 * Base modal surface on the native <dialog>: focus trap, Esc, inert page and
 * focus restore come from the browser. It fades and lifts in, and keeps its
 * children rendered while it fades out, so callers should keep passing the
 * content they showed. `window` is a fixed-size frame.
 */
export function Dialog({ open, onClose, label, labelledBy, size = 'sm', dismissible = true, role, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      return
    }
    if (!open && dialog.open) {
      dialog.close()
      setClosing(true)
      const timer = window.setTimeout(() => setClosing(false), EXIT_MS)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${s[size]}`}
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => dismissible && e.target === e.currentTarget && onClose()}
    >
      {(open || closing) && children}
    </dialog>
  )
}
