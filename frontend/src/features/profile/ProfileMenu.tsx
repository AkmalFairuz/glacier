import { LuEllipsis, LuShield } from 'react-icons/lu'
import type { User } from '../../lib/types'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { toast } from '../../ui/toast'
import { useMenu } from '../../ui/useMenu'
import { useModeration } from '../members/useModeration'
import { openFullProfile, openInviteToServer } from './profileStore'
import s from './ProfileMenu.module.css'

type Props = { user: User; serverId: string | null; isMe: boolean; inFullView?: boolean }

/** Round buttons on the banner: moderation (only for members who can kick or ban) and "more". */
export function ProfileMenu({ user, serverId, isMe, inFullView }: Props) {
  const more = useMenu()
  const mod = useMenu()
  const moderation = useModeration(serverId, user)
  const items: MenuEntry[] = [
    ...(inFullView ? [] : [{ label: 'View full profile', onSelect: () => openFullProfile(user.id, serverId) }]),
    ...(isMe ? [] : [{ label: 'Invite to server', onSelect: () => openInviteToServer(user.id) }]),
    'divider' as const,
    { label: 'Copy user ID', onSelect: () => void navigator.clipboard.writeText(user.id).then(() => toast.success('User ID copied')) },
  ]
  return (
    <>
      {moderation.length > 0 && (
        <>
          <button type="button" className={s.button} aria-label="Moderation" aria-haspopup="menu" onClick={mod.openBelow}>
            <LuShield />
          </button>
          <Menu anchor={mod.anchor} items={moderation} onClose={mod.close} label="Moderation" />
        </>
      )}
      <button type="button" className={s.button} aria-label="More" aria-haspopup="menu" onClick={more.openBelow}>
        <LuEllipsis />
      </button>
      <Menu anchor={more.anchor} items={items} onClose={more.close} label="Profile actions" />
    </>
  )
}
