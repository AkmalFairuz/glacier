import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuX } from 'react-icons/lu'
import { colorToHex } from '../../lib/format'
import { Select } from '../../ui/Select'
import { upsertMember } from '../members/cache'
import { membersApi } from '../members/api'
import type { ProfileData } from './useProfileData'
import s from './ProfileRoles.module.css'

/** Role chips; members with Manage Roles can add and remove them in place. */
export function ProfileRoles({ data }: { data: ProfileData }) {
  const qc = useQueryClient()
  const { member, memberRoles, assignableRoles, canManageRoles } = data
  const update = useMutation({
    mutationFn: (roleIds: string[]) => membersApi.update(member!.server_id, member!.user.id, { role_ids: roleIds }),
    onSuccess: (updated) => upsertMember(qc, updated),
  })
  if (!member || (!memberRoles.length && !canManageRoles)) return null
  const set = (ids: string[]) => update.mutate(ids)

  return (
    <section className={s.section} aria-label="Roles">
      <h3 className={s.heading}>Roles</h3>
      <ul className={s.chips}>
        {memberRoles.map((role) => (
          <li key={role.id} className={s.chip}>
            <span className={s.dot} style={{ backgroundColor: colorToHex(role.color) ?? 'var(--gray-500)' }} />
            {role.name}
            {canManageRoles && (
              <button type="button" className={s.remove} aria-label={`Remove ${role.name}`} onClick={() => set(member.role_ids.filter((id) => id !== role.id))}>
                <LuX />
              </button>
            )}
          </li>
        ))}
        {canManageRoles && assignableRoles.length > 0 && (
          <li className={s.add}>
            <Select
              value=""
              placeholder="Add role"
              aria-label="Add role"
              options={assignableRoles.map((r) => ({ value: r.id, label: r.name }))}
              onChange={(id) => set([...member.role_ids, id])}
            />
          </li>
        )}
      </ul>
    </section>
  )
}
