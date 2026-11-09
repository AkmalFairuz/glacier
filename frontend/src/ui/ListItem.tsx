import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import s from './ListItem.module.css'

type Props = {
  label: ReactNode
  /** Second line under the label, e.g. "3 members". */
  description?: ReactNode
  /** `tall`: 42px rows for avatar lists (DMs). */
  size?: 'default' | 'tall'
  icon?: ReactNode
  trailing?: ReactNode
  active?: boolean
  muted?: boolean
  /** New activity: bolder text and a pill on the left edge. */
  unread?: boolean
  to?: string
  onClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
}

export function ListItem({ label, description, size = 'default', icon, trailing, active, muted, unread, to, onClick, onContextMenu }: Props) {
  const className = [s.item, size === 'tall' && s.tall, active && s.active, muted && s.muted, unread && !active && s.unread].filter(Boolean).join(' ')
  const content = (
    <>
      {icon && <span className={s.icon}>{icon}</span>}
      {description ? (
        <span className={s.text}>
          <span className={s.label}>{label}</span>
          <span className={s.description}>{description}</span>
        </span>
      ) : (
        <span className={s.label}>{label}</span>
      )}
      {trailing && <span className={s.trailing}>{trailing}</span>}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={className} aria-current={active ? 'page' : undefined} onClick={onClick} onContextMenu={onContextMenu}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={onClick} onContextMenu={onContextMenu}>
      {content}
    </button>
  )
}
