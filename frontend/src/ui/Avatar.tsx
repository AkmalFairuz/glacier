import type { ReactNode } from 'react'
import { initials } from '../lib/format'
import s from './Avatar.module.css'

export type AvatarSize = 'xs' | 'sm' | 'mid' | 'md' | 'lg' | 'xl' | 'xxl'

type Props = {
  name: string
  src?: string | null
  size?: AvatarSize
  online?: boolean
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

export function Avatar({ name, src, size = 'md', online, seed, glyph }: Props) {
  const tone = src ? null : s[`tone${toneFor(seed ?? name)}`]
  return (
    <span className={[s.avatar, s[size], tone].filter(Boolean).join(' ')}>
      {src ? <img src={src} alt="" className={s.image} /> : <span aria-hidden="true">{glyph ?? initials(name)}</span>}
      {online !== undefined && <span className={online ? `${s.status} ${s.online}` : s.status} aria-label={online ? 'Online' : 'Offline'} role="img" />}
    </span>
  )
}
