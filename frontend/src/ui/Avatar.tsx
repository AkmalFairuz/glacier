import type { ReactNode } from 'react'
import { initials } from '../lib/format'
import type { Status } from '../lib/types'
import s from './Avatar.module.css'

export type AvatarSize = 'xs' | 'sm' | 'mid' | 'md' | 'lg' | 'xl' | 'xxl'

type Props = {
  name: string
  src?: string | null
  size?: AvatarSize
  online?: boolean
  /** Status badge; takes precedence over `online`. */
  status?: Status
  /** Stable key for the generated colors (a user or server id); falls back to the name. */
  seed?: string
  /** Shown instead of initials when there is no image (e.g. a group icon). */
  glyph?: ReactNode
}

const TONES = 8

/** Same seed, same tone, on every client. */
export function toneFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % TONES
}

const STATUS_NAMES: Record<Status, string> = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' }

export function Avatar({ name, src, size = 'md', online, status, seed, glyph }: Props) {
  const tone = src ? null : s[`tone${toneFor(seed ?? name)}`]
  const shown = status ?? (online === undefined ? undefined : online ? 'online' : 'offline')
  return (
    <span className={[s.avatar, s[size], tone].filter(Boolean).join(' ')}>
      {src ? <img src={src} alt="" className={s.image} /> : <span aria-hidden="true">{glyph ?? initials(name)}</span>}
      {shown && <span className={[s.status, shown !== 'offline' && s[shown]].filter(Boolean).join(' ')} aria-label={STATUS_NAMES[shown]} role="img" />}
    </span>
  )
}
