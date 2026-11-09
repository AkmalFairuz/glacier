import { useState } from 'react'
import { LuBan, LuLink, LuSettings2, LuShieldCheck, LuTriangleAlert } from 'react-icons/lu'
import { can, Perm } from '../../lib/permissions'
import type { Server } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { SettingsShell } from '../../ui/SettingsShell'
import type { NavItem } from '../../ui/SettingsNav'
import { useMe } from '../auth/useSession'
import { InvitesPanel } from '../invites/InvitesPanel'
import { BansPanel } from '../members/BansPanel'
import { RolesPanel } from '../roles/RolesPanel'
import { usePermissions } from './hooks'
import { DangerZone } from './DangerZone'
import { ServerOverview } from './ServerOverview'
import s from './ServerSettings.module.css'

type PageId = 'overview' | 'roles' | 'invites' | 'bans' | 'danger'

type Props = { server: Server; open: boolean; onClose: () => void }

export function ServerSettings({ server, open, onClose }: Props) {
  const { data: me } = useMe()
  const perms = usePermissions(server.id).data?.server
  const all: (false | (NavItem & { id: PageId }))[] = [
    can(perms, Perm.MANAGE_SERVER) && { id: 'overview', label: 'Overview', icon: <LuSettings2 />, keywords: 'name icon description public delete' },
    can(perms, Perm.MANAGE_ROLES) && { id: 'roles', label: 'Roles', icon: <LuShieldCheck />, keywords: 'permissions color admin mod' },
    can(perms, Perm.MANAGE_SERVER) && { id: 'invites', label: 'Invites', icon: <LuLink />, keywords: 'links codes' },
    can(perms, Perm.BAN_MEMBERS) && { id: 'bans', label: 'Bans', icon: <LuBan />, keywords: 'banned unban' },
    me?.id === server.owner_id && { id: 'danger', label: 'Danger zone', icon: <LuTriangleAlert />, keywords: 'delete server' },
  ]
  const items = all.filter((item) => item !== false)
  const [selected, setSelected] = useState<PageId>('overview')
  const page = items.find((i) => i.id === selected) ?? items[0]

  return (
    <SettingsShell
      open={open}
      onClose={onClose}
      label="Server settings"
      groups={[{ label: server.name, items }]}
      active={page?.id ?? 'overview'}
      onSelect={(id) => setSelected(id as PageId)}
      title={page?.label ?? 'Server settings'}
      searchable={false}
      fill={page?.id === 'roles'}
      header={
        <div className={s.header}>
          <Avatar name={server.name} src={server.icon_url} seed={server.id} size="lg" />
          <span className={s.name}>{server.name}</span>
        </div>
      }
    >
      {page?.id === 'overview' && <ServerOverview server={server} />}
      {page?.id === 'roles' && <RolesPanel serverId={server.id} />}
      {page?.id === 'invites' && <InvitesPanel serverId={server.id} />}
      {page?.id === 'bans' && <BansPanel serverId={server.id} />}
      {page?.id === 'danger' && <DangerZone server={server} onDone={onClose} />}
    </SettingsShell>
  )
}
