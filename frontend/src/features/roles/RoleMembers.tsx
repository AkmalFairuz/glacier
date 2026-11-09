import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuX } from 'react-icons/lu'
import type { Member, Role } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { EmptyState } from '../../ui/EmptyState'
import { Select } from '../../ui/Select'
import { membersApi } from '../members/api'
import { upsertMember } from '../members/cache'
import { useMembers } from '../members/hooks'
import s from './RoleMembers.module.css'

/** Who holds a role; add and remove members in place. */
export function RoleMembers({ role }: { role: Role }) {
  const qc = useQueryClient()
  const { data: members = [] } = useMembers(role.server_id)
  const holders = members.filter((m) => m.role_ids.includes(role.id))
  const others = members.filter((m) => !m.role_ids.includes(role.id))
  const update = useMutation({
    mutationFn: ({ member, roleIds }: { member: Member; roleIds: string[] }) => membersApi.update(role.server_id, member.user.id, { role_ids: roleIds }),
    onSuccess: (updated) => upsertMember(qc, updated),
  })
  const name = (m: Member) => m.nickname ?? m.user.display_name

  return (
    <>
      {others.length > 0 && (
        <Select
          value=""
          placeholder="Add members"
          aria-label={`Add a member to ${role.name}`}
          options={others.map((m) => ({ value: m.user.id, label: name(m) }))}
          onChange={(id) => {
            const member = others.find((m) => m.user.id === id)
            if (member) update.mutate({ member, roleIds: [...member.role_ids, role.id] })
          }}
        />
      )}
      {holders.length === 0 ? (
        <EmptyState title="Nobody has this role" />
      ) : (
        <ul className={s.list}>
          {holders.map((m) => (
            <li key={m.user.id} className={s.row}>
              <Avatar name={name(m)} src={m.user.avatar_url} seed={m.user.id} size="sm" />
              <span className={s.name}>{name(m)}</span>
              <span className={s.username}>@{m.user.username}</span>
              <button
                type="button"
                className={s.remove}
                aria-label={`Remove ${name(m)} from ${role.name}`}
                onClick={() => update.mutate({ member: m, roleIds: m.role_ids.filter((id) => id !== role.id) })}
              >
                <LuX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
