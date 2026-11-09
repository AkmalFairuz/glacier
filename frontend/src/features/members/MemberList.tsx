import type { Member, Role } from '../../lib/types'
import { useRoles } from '../roles/hooks'
import { useServer } from '../servers/hooks'
import { useMembers } from './hooks'
import { MemberItem } from './MemberItem'
import { usePresence } from './presenceStore'
import s from './MemberList.module.css'

type Section = { id: string; title: string; members: Member[] }

/** Online members grouped under their highest role (roles only), like a server roster; offline last. */
function sections(members: Member[], roles: Role[], isOnline: (m: Member) => boolean): Section[] {
  const ranked = roles.filter((r) => !r.is_default)
  const byName = [...members].sort((a, b) => (a.nickname ?? a.user.display_name).localeCompare(b.nickname ?? b.user.display_name))
  const groups = new Map<string, Section>()
  const online: Member[] = []
  const offline: Member[] = []
  for (const m of byName) {
    if (!isOnline(m)) {
      offline.push(m)
      continue
    }
    const top = ranked.find((r) => m.role_ids.includes(r.id))
    if (!top) {
      online.push(m)
      continue
    }
    const group = groups.get(top.id) ?? { id: top.id, title: top.name, members: [] }
    group.members.push(m)
    groups.set(top.id, group)
  }
  return [
    ...ranked.map((r) => groups.get(r.id)).filter((g): g is Section => !!g),
    { id: 'online', title: 'Online', members: online },
    { id: 'offline', title: 'Offline', members: offline },
  ].filter((g) => g.members.length > 0)
}

export function MemberList({ serverId }: { serverId: string }) {
  const { data: members = [] } = useMembers(serverId)
  const { data: roles = [] } = useRoles(serverId)
  const server = useServer(serverId)
  const presence = usePresence()
  const isOnline = (m: Member) => (presence[m.user.id]?.status ?? m.status) !== 'offline'

  return (
    <aside className={s.list} aria-label="Members">
      {sections(members, roles, isOnline).map((section) => (
        <section key={section.id} className={s.section}>
          <h2 className={s.heading}>
            {section.title} — {section.members.length}
          </h2>
          <ul>
            {section.members.map((m) => (
              <MemberItem key={m.user.id} member={m} roles={roles} isOwner={server?.owner_id === m.user.id} />
            ))}
          </ul>
        </section>
      ))}
    </aside>
  )
}
