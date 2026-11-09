import { useRef, useState, type ReactNode } from 'react'
import s from './Tooltip.module.css'

type Side = 'top' | 'right' | 'bottom'
type Props = { label: string; side?: Side; children: ReactNode }

/** Fixed-position label so it is never clipped by scrolling containers. */
export function Tooltip({ label, side = 'top', children }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    if (side === 'right') setPos({ x: r.right + 8, y: r.top + r.height / 2 })
    else if (side === 'bottom') setPos({ x: r.left + r.width / 2, y: r.bottom + 6 })
    else setPos({ x: r.left + r.width / 2, y: r.top - 6 })
  }
  const hide = () => setPos(null)

  return (
    <span
      ref={ref}
      className={s.wrap}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(e) => e.target.matches(':focus-visible') && show()}
      onBlur={hide}
    >
      {children}
      {pos && (
        <span role="tooltip" className={`${s.tip} ${s[side]}`} style={{ left: pos.x, top: pos.y }}>
          {label}
        </span>
      )}
    </span>
  )
}
