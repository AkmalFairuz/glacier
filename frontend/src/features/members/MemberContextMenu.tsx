import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuMessageSquare, LuShieldCheck } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { can, Perm } from '../../lib/permissions'
import type { Member, Role } from '../../lib/types'
import { Menu, type MenuAnchor, type MenuEntry } from '../../ui/Menu'
import { useMe } from '../auth/useSession'
import { openDm } from '../dms/api'
import { upsertDm } from '../dms/cache'
import { usePermissions, useServer } from '../servers/hooks'
import { membersApi } from './api'
import { upsertMember } from './cache'
import { useMembers } from './hooks'
import { useModeration } from './useModeration'

type Props = { member: Member; roles: Role[]; anchor: MenuAnchor | null; onClose: () => void }

export function MemberContextMenu({ member, roles, anchor, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const serverId = member.server_id
  const server = useServer(serverId)
  const { data: me } = useMe()
  const perms = usePermissions(serverId).data?.server
  const myRoleIds = useMembers(serverId).data?.find((m) => m.user.id === me?.id)?.role_ids ?? []
  const isSelf = member.user.id === me?.id
  const iAmOwner = server?.owner_id === me?.id
  const moderation = useModeration(serverId, member.user)
  const myTop = Math.max(0, ...roles.filter((r) => myRoleIds.includes(r.id)).map((r) => r.position))

  const setRoles = useMutation({
    mutationFn: (roleIds: string[]) => membersApi.update(serverId, member.user.id, { role_ids: roleIds }),
    onSuccess: (updated) => upsertMember(qc, updated),
  })
  const message = async () => {
    const channel = await openDm([member.user.id])
    upsertDm(qc, channel)
    navigate(`/channels/@me/${channel.id}`)
  }

  const toggleRole = (roleId: string) =>
    setRoles.mutate(member.role_ids.includes(roleId) ? member.role_ids.filter((id) => id !== roleId) : [...member.role_ids, roleId])

  const assignable = roles.filter((r) => !r.is_default && (iAmOwner || r.position < myTop))
  const items: MenuEntry[] = [
    { heading: `@${member.user.username}` },
    ...(!isSelf ? [{ label: 'Message', icon: <LuMessageSquare />, onSelect: () => void message() }] : []),
    // Roles open in a submenu, each a checkbox, so the menu stays short however many roles exist.
    ...(can(perms, Perm.MANAGE_ROLES) && assignable.length
      ? [
          {
            label: 'Roles',
            icon: <LuShieldCheck />,
            submenu: assignable.map((r) => ({ label: r.name, checked: member.role_ids.includes(r.id), onSelect: () => toggleRole(r.id) })),
          },
        ]
      : []),
    ...(moderation.length ? (['divider', ...moderation] as MenuEntry[]) : []),
  ]

  return <Menu label={`Actions for ${member.user.display_name}`} anchor={anchor} onClose={onClose} items={items} />
}
