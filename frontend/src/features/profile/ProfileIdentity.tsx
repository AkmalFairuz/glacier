import { LuCrown } from 'react-icons/lu'
import type { ProfileData } from './useProfileData'
import s from './ProfileIdentity.module.css'

/** Name block: server nickname (or display name), then @username. */
export function ProfileIdentity({ data, large }: { data: ProfileData; large?: boolean }) {
  const { user, member, isOwner } = data
  if (!user) return null
  const name = member?.nickname ?? user.display_name
  return (
    <header className={s.identity}>
      <h2 className={large ? `${s.name} ${s.large}` : s.name}>
        {name}
        {isOwner && <LuCrown className={s.crown} aria-label="Server owner" />}
      </h2>
      <p className={s.username}>
        @{user.username}
        {member?.nickname && <span className={s.alias}>{user.display_name}</span>}
      </p>
    </header>
  )
}
