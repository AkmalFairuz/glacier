import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { MenuAnchor } from './Menu'
import s from './Popover.module.css'

type Props = { anchor: MenuAnchor | null; onClose: () => void; label: string; children: ReactNode }

/** Fixed-position panel clamped to the viewport; closes on Escape or outside click. */
export function Popover({ anchor, onClose, label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    if (!el.matches(':popover-open')) el.showPopover()
    const rect = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(anchor.x, innerWidth - rect.width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(anchor.y, innerHeight - rect.height - 8))}px`
    el.querySelector<HTMLElement>('button, input')?.focus()
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown))
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [anchor, onClose])

  if (!anchor) return null
  return (
    <div ref={ref} popover="manual" role="dialog" aria-label={label} className={s.popover} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {children}
    </div>
  )
}
