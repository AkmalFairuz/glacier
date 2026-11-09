import { LuCrown } from 'react-icons/lu'
import { colorToHex } from '../../lib/format'
import type { Member, Role } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { useMenu } from '../../ui/useMenu'
import { topColoredRole } from '../roles/hooks'
import { openProfileCard } from '../profile/profileStore'
import { MemberContextMenu } from './MemberContextMenu'
import { activeCustomStatus, usePresenceOf } from './presenceStore'
import { CustomStatusText } from '../user/CustomStatusText'
import s from './MemberItem.module.css'

type Props = { member: Member; roles: Role[]; isOwner: boolean }

export function MemberItem({ member, roles, isOwner }: Props) {
  const menu = useMenu()
  const presence = usePresenceOf(member.user.id, { status: member.status, custom_status: member.custom_status ?? null })
  const online = presence.status !== 'offline'
  const custom = online ? activeCustomStatus(presence.custom_status) : null
  const color = colorToHex(topColoredRole(roles, member.role_ids)?.color ?? null)
  const name = member.nickname ?? member.user.display_name

  return (
    <li>
      <button
        type="button"
        className={online ? s.item : `${s.item} ${s.offline}`}
        onClick={(e) => openProfileCard(member.user.id, member.server_id, e.currentTarget)}
        onContextMenu={menu.openAtPointer}
      >
        <Avatar name={name} src={member.user.avatar_url} seed={member.user.id} size="sm" status={presence.status} />
        <span className={s.names}>
          <span className={s.name} style={color ? { color } : undefined}>
            {name}
          </span>
          {custom && <CustomStatusText custom={custom} className={s.custom} />}
        </span>
        {isOwner && <LuCrown className={s.owner} title="Server owner" />}
      </button>
      <MemberContextMenu member={member} roles={roles} anchor={menu.anchor} onClose={menu.close} />
    </li>
  )
}
