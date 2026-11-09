import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LuChevronDown, LuLogOut, LuPlus, LuSettings, LuUserPlus } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { can, Perm } from '../../lib/permissions'
import type { Server } from '../../lib/types'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useMenu } from '../../ui/useMenu'
import { useMe } from '../auth/useSession'
import { InviteModal } from '../invites/InviteModal'
import { serversApi } from '../servers/api'
import { removeServer } from '../servers/cache'
import { usePermissions } from '../servers/hooks'
import { ServerSettings } from '../servers/ServerSettings'
import { ChannelList } from './ChannelList'
import { CreateChannelModal } from './CreateChannelModal'
import s from './ChannelSidebar.module.css'
import { confirmDialog } from '../../ui/confirm'

type Dialog = { kind: 'invite' } | { kind: 'settings' } | { kind: 'create'; parentId: string | null } | null

export function ChannelSidebar({ server }: { server: Server }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const perms = usePermissions(server.id).data?.server
  const menu = useMenu()
  const [dialog, setDialog] = useState<Dialog>(null)
  const isOwner = me?.id === server.owner_id
  const canSettings = [Perm.MANAGE_SERVER, Perm.MANAGE_ROLES, Perm.BAN_MEMBERS].some((bit) => can(perms, bit))

  const items: MenuEntry[] = [
    ...(can(perms, Perm.CREATE_INVITE) ? [{ label: 'Invite people', icon: <LuUserPlus />, onSelect: () => setDialog({ kind: 'invite' }) }] : []),
    ...(canSettings ? [{ label: 'Server settings', icon: <LuSettings />, onSelect: () => setDialog({ kind: 'settings' }) }] : []),
    ...(can(perms, Perm.MANAGE_CHANNELS) ? [{ label: 'Create channel', icon: <LuPlus />, onSelect: () => setDialog({ kind: 'create', parentId: null }) }] : []),
    ...(!isOwner ? (['divider', { label: 'Leave server', icon: <LuLogOut />, danger: true, onSelect: () => leave() }] as MenuEntry[]) : []),
  ]

  const leave = async () => {
    if (
      !(await confirmDialog({
        title: `Leave ${server.name}`,
        message: 'You will need an invite to rejoin unless it is public.',
        confirmLabel: 'Leave server',
        danger: true,
      }))
    )
      return
    await serversApi.leave(server.id)
    removeServer(qc, server.id)
    navigate('/channels/@me')
  }

  return (
    <div className={s.sidebar}>
      <button type="button" className={s.header} onClick={menu.openBelow} aria-haspopup="menu">
        <span className={s.name}>{server.name}</span>
        <LuChevronDown aria-hidden="true" />
      </button>
      <Menu label="Server options" anchor={menu.anchor} onClose={menu.close} items={items} />
      <nav className={s.channels} aria-label="Channels">
        <ChannelList serverId={server.id} onCreate={(parentId) => setDialog({ kind: 'create', parentId })} />
      </nav>
      <InviteModal serverId={server.id} open={dialog?.kind === 'invite'} onClose={() => setDialog(null)} />
      <ServerSettings server={server} open={dialog?.kind === 'settings'} onClose={() => setDialog(null)} />
      <CreateChannelModal
        serverId={server.id}
        parentId={dialog?.kind === 'create' ? dialog.parentId : null}
        open={dialog?.kind === 'create'}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
