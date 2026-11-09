import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LuHash, LuTrash2, LuVolume2 } from 'react-icons/lu'
import { can, Perm } from '../../lib/permissions'
import type { Channel } from '../../lib/types'
import { Button } from '../../ui/Button'
import { confirmDialog } from '../../ui/confirm'
import { SettingsShell } from '../../ui/SettingsShell'
import type { NavItem } from '../../ui/SettingsNav'
import { useChannelPermissions } from '../servers/hooks'
import { channelsApi } from './api'
import { removeChannel } from './cache'
import { ChannelOverviewPage } from './ChannelOverviewPage'
import { ChannelPermissionsPage } from './ChannelPermissionsPage'
import { useChannels } from './hooks'
import s from './ChannelSettings.module.css'

type Page = 'overview' | 'permissions'
type Props = { channel: Channel; open: boolean; onClose: () => void }

export function ChannelSettings({ channel, open, onClose }: Props) {
  const qc = useQueryClient()
  const perms = useChannelPermissions(channel.server_id ?? undefined, channel.id)
  const category = useChannels(channel.server_id ?? undefined).data?.find((c) => c.id === channel.parent_id)
  const [page, setPage] = useState<Page>('overview')
  const remove = useMutation({
    mutationFn: () => channelsApi.remove(channel.id),
    onSuccess: () => {
      onClose()
      removeChannel(qc, channel.server_id!, channel.id)
    },
  })

  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', keywords: 'name topic slowmode user limit' },
    ...(can(perms, Perm.MANAGE_ROLES) ? [{ id: 'permissions', label: 'Permissions', keywords: 'private roles members access' }] : []),
  ]
  const current = items.find((i) => i.id === page) ?? items[0]

  const onDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete #${channel.name}`,
      message: 'Its messages are permanently deleted.',
      confirmLabel: 'Delete channel',
      danger: true,
    })
    if (ok) remove.mutate()
  }

  return (
    <SettingsShell
      open={open}
      onClose={onClose}
      label="Channel settings"
      groups={[{ items }]}
      active={current.id}
      onSelect={(id) => setPage(id as Page)}
      title={current.label}
      searchable={false}
      header={
        <p className={s.header}>
          {channel.type === 'voice' ? <LuVolume2 aria-hidden="true" /> : <LuHash aria-hidden="true" />}
          <span className={s.name}>{channel.name}</span>
          {category && <span className={s.category}>{category.name}</span>}
        </p>
      }
      footer={
        <Button variant="ghost" icon={<LuTrash2 />} className={s.delete} loading={remove.isPending} onClick={() => void onDelete()}>
          Delete channel
        </Button>
      }
    >
      {current.id === 'overview' ? <ChannelOverviewPage channel={channel} /> : <ChannelPermissionsPage channel={channel} />}
    </SettingsShell>
  )
}
