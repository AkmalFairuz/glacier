import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { keys } from '../../lib/keys'
import { can, Perm } from '../../lib/permissions'
import type { Channel } from '../../lib/types'
import { usePermissions } from '../servers/hooks'
import { channelsApi } from './api'
import { ChannelCategory } from './ChannelCategory'
import { ChannelItem } from './ChannelItem'
import { changed, moveCategory, moveChannel, stepSlot, toPositions } from './channelOrder'
import { groupChannels, useChannels, type ChannelGroup } from './hooks'
import { useChannelDrag, type Drop } from './useChannelDrag'
import s from './ChannelList.module.css'

type Props = { serverId: string; onCreate: (parentId: string | null) => void }

export function ChannelList({ serverId, onCreate }: Props) {
  const qc = useQueryClient()
  const container = useRef<HTMLDivElement>(null)
  const { data: channels = [] } = useChannels(serverId)
  const { data: perms } = usePermissions(serverId)
  const channelPerms = (id: string) => perms?.channels[id] ?? perms?.server
  const canManage = can(perms?.server, Perm.MANAGE_CHANNELS)
  const groups = groupChannels(channels)

  const reorder = useMutation({
    mutationFn: (body: ReturnType<typeof toPositions>) => channelsApi.reorder(serverId, body),
    onSuccess: (list) => qc.setQueryData(keys.channels(serverId), list),
    onError: () => void qc.invalidateQueries({ queryKey: keys.channels(serverId) }),
  })

  const apply = (next: ChannelGroup[]) => {
    const diff = changed(channels, toPositions(next))
    if (!diff.length) return
    qc.setQueryData<Channel[]>(keys.channels(serverId), (list) =>
      list?.map((c) => {
        const p = diff.find((d) => d.id === c.id)
        return p ? { ...c, position: p.position, parent_id: p.parent_id ?? null } : c
      }),
    )
    reorder.mutate(diff)
  }

  const onDrop = (id: string, drop: Drop) => {
    if (drop.kind === 'category') return apply(moveCategory(groups, id, drop.index))
    const channel = channels.find((c) => c.id === id)
    if (channel) apply(moveChannel(groups, channel, drop.slot))
  }

  const dnd = useChannelDrag(container, groups, onDrop)

  const move = (channel: Channel, delta: -1 | 1) => {
    const slot = stepSlot(groups, channel, delta)
    if (slot) apply(moveChannel(groups, channel, slot))
  }

  return (
    <div ref={container} className={s.tree}>
      {groups.map(({ category, channels: children }) => {
        const items = children.map((channel, i) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            canManage={can(channelPerms(channel.id), Perm.MANAGE_CHANNELS)}
            canConnect={can(channelPerms(channel.id), Perm.CONNECT)}
            dragProps={dnd.rowProps(channel.id, 'channel', canManage)}
            onMoveUp={canManage && i > 0 ? () => move(channel, -1) : undefined}
            onMoveDown={canManage && i < children.length - 1 ? () => move(channel, 1) : undefined}
          />
        ))
        if (!category) {
          return (
            <ul key="loose" className={s.loose}>
              {items}
            </ul>
          )
        }
        return (
          <ChannelCategory
            key={category.id}
            name={category.name ?? ''}
            onCreate={canManage ? () => onCreate(category.id) : undefined}
            dragProps={dnd.rowProps(category.id, 'category', canManage)}
          >
            {items}
          </ChannelCategory>
        )
      })}
      {dnd.line !== null && <span className={s.dropLine} style={{ top: dnd.line }} aria-hidden="true" />}
    </div>
  )
}
