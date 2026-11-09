import type { CSSProperties, ReactNode } from 'react'
import { colorToHex } from '../../lib/format'
import type { Status, User } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import s from './ProfileBanner.module.css'

type Props = { user: User; status: Status; size?: 'card' | 'full'; actions?: ReactNode }

/** Banner strip in the user's color with the avatar overlapping its lower edge. */
export function ProfileBanner({ user, status, size = 'card', actions }: Props) {
  const color = colorToHex(user.banner_color)
  return (
    <div className={`${s.banner} ${s[size]}`} style={color ? ({ '--banner': color } as CSSProperties) : undefined}>
      {actions && <div className={s.actions}>{actions}</div>}
      <span className={s.avatar}>
        <Avatar name={user.display_name} src={user.avatar_url} seed={user.id} size={size === 'full' ? 'xxl' : 'xl'} status={status} />
      </span>
    </div>
  )
}
