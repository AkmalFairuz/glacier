import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HTMLAttributes } from 'react'
import { LuArrowDown, LuArrowUp, LuHash, LuPencil, LuSettings, LuTrash2, LuVolume2 } from 'react-icons/lu'
import { useParams } from 'react-router'
import type { Channel } from '../../lib/types'
import { IconButton } from '../../ui/IconButton'
import { ListItem } from '../../ui/ListItem'
import { Menu } from '../../ui/Menu'
import { useMenu } from '../../ui/useMenu'
import { layout } from '../../app/layoutStore'
import { joinVoice } from '../voice/useVoiceRoom'
import { VoiceUserList } from '../voice/VoiceUserList'
import { useRoomStates } from '../voice/voiceStore'
import { channelsApi } from './api'
import { removeChannel } from './cache'
import { useChannelUnread } from '../reads/readStore'
import { openChannelSettings } from './channelSettingsStore'
import s from './ChannelItem.module.css'
import { confirmDialog } from '../../ui/confirm'

type Props = {
  channel: Channel
  canManage: boolean
  canConnect: boolean
  dragProps?: HTMLAttributes<HTMLElement>
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function ChannelItem({ channel, canManage, canConnect, dragProps, onMoveUp, onMoveDown }: Props) {
  const qc = useQueryClient()
  const { channelId } = useParams()
  const menu = useMenu()
  const remove = useMutation({
    mutationFn: () => channelsApi.remove(channel.id),
    onSuccess: () => removeChannel(qc, channel.server_id!, channel.id),
  })
  const isVoice = channel.type === 'voice'
  const unread = useChannelUnread(channel.id)
  const inRoom = useRoomStates(channel.id).length

  const onClick = () => {
    layout.closeNav()
    if (isVoice && canConnect) void joinVoice(channel.id, channel.server_id)
  }

  return (
    <li className={s.item} {...dragProps}>
      <ListItem
        to={`/channels/${channel.server_id}/${channel.id}`}
        icon={isVoice ? <LuVolume2 /> : <LuHash />}
        label={channel.name}
        active={channelId === channel.id}
        unread={unread}
        trailing={isVoice && channel.user_limit ? <span className={s.limit}>{`${inRoom}/${channel.user_limit}`}</span> : undefined}
        onClick={onClick}
        onContextMenu={canManage ? menu.openAtPointer : undefined}
      />
      {canManage && (
        <span className={s.gear} data-no-drag>
          <IconButton size="sm" label={`Edit ${channel.name}`} icon={<LuSettings />} onClick={() => openChannelSettings(channel.server_id!, channel.id)} />
        </span>
      )}
      {isVoice && <VoiceUserList channelId={channel.id} serverId={channel.server_id} />}
      <Menu
        label={`${channel.name} options`}
        anchor={menu.anchor}
        onClose={menu.close}
        items={[
          { label: 'Edit channel', icon: <LuPencil />, onSelect: () => openChannelSettings(channel.server_id!, channel.id) },
          ...(onMoveUp ? [{ label: 'Move up', icon: <LuArrowUp />, onSelect: onMoveUp }] : []),
          ...(onMoveDown ? [{ label: 'Move down', icon: <LuArrowDown />, onSelect: onMoveDown }] : []),
          {
            label: 'Delete channel',
            icon: <LuTrash2 />,
            danger: true,
            onSelect: async () =>
              (await confirmDialog({
                title: `Delete #${channel.name}`,
                message: 'Its messages are permanently deleted.',
                confirmLabel: 'Delete channel',
                danger: true,
              })) && remove.mutate(),
          },
        ]}
      />
    </li>
  )
}
