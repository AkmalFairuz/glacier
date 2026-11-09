import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LuLock, LuShield } from 'react-icons/lu'
import { Perm, PERMISSION_INFO, type PermKey } from '../../lib/permissions'
import type { Channel, Overwrite, TargetType } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { ListItem } from '../../ui/ListItem'
import { Select } from '../../ui/Select'
import { Toggle } from '../../ui/Toggle'
import { useMembers } from '../members/hooks'
import { useRoles } from '../roles/hooks'
import { channelsApi } from './api'
import { upsertChannel } from './cache'
import { PermissionTriState, type TriValue } from './PermissionTriState'
import s from './ChannelSettingsPages.module.css'

const GROUPS: { title: string; keys: PermKey[]; only?: Channel['type'] }[] = [
  { title: 'General', keys: ['VIEW_CHANNEL', 'MANAGE_CHANNELS', 'MANAGE_ROLES'] },
  { title: 'Text', keys: ['SEND_MESSAGES', 'ATTACH_FILES', 'ADD_REACTIONS', 'MANAGE_MESSAGES'], only: 'text' },
  { title: 'Voice', keys: ['CONNECT', 'SPEAK', 'VIDEO'], only: 'voice' },
]

const tri = (o: Overwrite | undefined, bit: number): TriValue => (!o ? 'inherit' : o.allow & bit ? 'allow' : o.deny & bit ? 'deny' : 'inherit')

export function ChannelPermissionsPage({ channel }: { channel: Channel }) {
  const qc = useQueryClient()
  const serverId = channel.server_id!
  const { data: roles = [] } = useRoles(serverId)
  const { data: members = [] } = useMembers(serverId)
  const [selected, setSelected] = useState(serverId)
  const [added, setAdded] = useState<{ target_id: string; target_type: TargetType }[]>([])

  const save = useMutation({
    mutationFn: ({ target_id, target_type, allow, deny }: Overwrite) =>
      allow === 0 && deny === 0
        ? channelsApi.deleteOverwrite(channel.id, target_id)
        : channelsApi.putOverwrite(channel.id, target_id, { target_type, allow, deny }),
    onMutate: (next) => {
      const others = channel.overwrites.filter((o) => o.target_id !== next.target_id)
      upsertChannel(qc, { ...channel, overwrites: next.allow || next.deny ? [...others, next] : others })
    },
    onSuccess: (updated) => upsertChannel(qc, updated),
  })

  const overwriteOf = (id: string) => channel.overwrites.find((o) => o.target_id === id)
  const targets = [
    { target_id: serverId, target_type: 'role' as const },
    ...channel.overwrites.filter((o) => o.target_id !== serverId),
    ...added.filter((a) => a.target_id !== serverId && !overwriteOf(a.target_id)),
  ]
  const current = targets.find((t) => t.target_id === selected) ?? targets[0]
  const nameOf = (t: { target_id: string; target_type: TargetType }) =>
    t.target_id === serverId
      ? '@everyone'
      : t.target_type === 'role'
        ? (roles.find((r) => r.id === t.target_id)?.name ?? 'Unknown role')
        : (members.find((m) => m.user.id === t.target_id)?.user.display_name ?? 'Unknown member')

  const set = (target: { target_id: string; target_type: TargetType }, bit: number, value: TriValue) => {
    const o = overwriteOf(target.target_id) ?? { ...target, allow: 0, deny: 0 }
    save.mutate({
      ...o,
      allow: value === 'allow' ? o.allow | bit : o.allow & ~bit,
      deny: value === 'deny' ? o.deny | bit : o.deny & ~bit,
    })
  }

  const memberAvatar = (id: string) => {
    const user = members.find((m) => m.user.id === id)?.user
    return <Avatar name={user?.display_name ?? '?'} src={user?.avatar_url} seed={id} size="xs" />
  }
  const isPrivate = tri(overwriteOf(serverId), Perm.VIEW_CHANNEL) === 'deny'
  const unused = (id: string) => !targets.some((t) => t.target_id === id)

  return (
    <>
      <div className={s.privateCard}>
        <LuLock aria-hidden="true" />
        <Toggle
          label="Private channel"
          description="Only roles and members you allow below can see it."
          checked={isPrivate}
          onChange={(on) => set({ target_id: serverId, target_type: 'role' }, Perm.VIEW_CHANNEL, on ? 'deny' : 'inherit')}
        />
      </div>

      <div className={s.advanced}>
        <aside className={s.targets} aria-label="Roles and members">
          <h3 className={s.targetsHead}>Roles and members</h3>
          <ul>
            {targets.map((t) => (
              <li key={t.target_id}>
                <ListItem
                  icon={t.target_type === 'role' ? <LuShield /> : memberAvatar(t.target_id)}
                  label={nameOf(t)}
                  active={t.target_id === current.target_id}
                  onClick={() => setSelected(t.target_id)}
                />
              </li>
            ))}
          </ul>
          <Select
            value=""
            placeholder="Add role or member"
            aria-label="Add a role or member"
            onChange={(value) => {
              const [type, id] = value.split(':') as [TargetType, string]
              setAdded((a) => [...a, { target_id: id, target_type: type }])
              setSelected(id)
            }}
            options={[
              ...roles.filter((r) => !r.is_default && unused(r.id)).map((r) => ({ value: `role:${r.id}`, label: r.name, group: 'Roles' })),
              ...members.filter((m) => unused(m.user.id)).map((m) => ({ value: `member:${m.user.id}`, label: m.user.display_name, group: 'Members' })),
            ]}
          />
        </aside>

        <section key={current.target_id} aria-label={`Permissions for ${nameOf(current)}`}>
          {GROUPS.filter((g) => !g.only || g.only === channel.type).map((group) => (
            <div key={group.title} className={s.group}>
              <h3 className={s.groupTitle}>{group.title}</h3>
              {group.keys.map((key) => {
                const info = PERMISSION_INFO.find((p) => p.key === key)!
                return (
                  <PermissionTriState
                    key={key}
                    label={info.label}
                    description={info.description}
                    value={tri(overwriteOf(current.target_id), Perm[key])}
                    onChange={(v) => set(current, Perm[key], v)}
                  />
                )
              })}
            </div>
          ))}
          {current.target_id !== serverId && overwriteOf(current.target_id) && (
            <Button variant="ghost" className={s.removeOverride} onClick={() => save.mutate({ ...overwriteOf(current.target_id)!, allow: 0, deny: 0 })}>
              Remove {nameOf(current)} from this channel’s overrides
            </Button>
          )}
        </section>
      </div>
    </>
  )
}
