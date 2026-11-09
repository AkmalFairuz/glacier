import { useState } from 'react'
import { LuHeadphoneOff, LuHeadphones, LuMic, LuMicOff, LuSettings, LuSmilePlus, LuX } from 'react-icons/lu'
import type { StatusSetting } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { IconButton } from '../../ui/IconButton'
import { Menu } from '../../ui/Menu'
import { StatusDot } from '../../ui/StatusDot'
import { useMenu } from '../../ui/useMenu'
import { useMe } from '../auth/useSession'
import { activeCustomStatus, shownStatus, STATUS_LABELS, useMyPresence } from '../members/presenceStore'
import { voiceActions } from '../voice/useVoiceRoom'
import { useVoice } from '../voice/voiceStore'
import { openSettings } from '../settings/settingsWindow'
import { CustomStatusDialog } from './CustomStatusDialog'
import { CustomStatusText } from './CustomStatusText'
import { useUpdatePresence } from './presenceApi'
import s from './UserPanel.module.css'

const STATUSES: StatusSetting[] = ['online', 'idle', 'dnd', 'invisible']

export function UserPanel() {
  const { data: me } = useMe()
  const muted = useVoice((st) => st.muted)
  const deafened = useVoice((st) => st.deafened)
  const mine = useMyPresence()
  const menu = useMenu()
  const update = useUpdatePresence()
  const [editing, setEditing] = useState(false)
  if (!me) return null
  const custom = activeCustomStatus(mine.custom_status)

  return (
    <section className={s.panel} aria-label="Your account">
      <button type="button" className={s.identity} aria-haspopup="menu" aria-label={`Set status (${STATUS_LABELS[mine.status]})`} onClick={menu.openBelow}>
        <Avatar name={me.display_name} src={me.avatar_url} seed={me.id} size="sm" status={shownStatus(mine.status)} />
        <span className={s.names}>
          <span className={s.display}>{me.display_name}</span>
          {custom ? <CustomStatusText custom={custom} className={s.username} /> : <span className={s.username}>@{me.username}</span>}
        </span>
      </button>
      <IconButton size="sm" label={muted ? 'Unmute' : 'Mute'} icon={muted ? <LuMicOff /> : <LuMic />} active={muted} onClick={voiceActions.toggleMute} />
      <IconButton
        size="sm"
        label={deafened ? 'Undeafen' : 'Deafen'}
        icon={deafened ? <LuHeadphoneOff /> : <LuHeadphones />}
        active={deafened}
        onClick={voiceActions.toggleDeafen}
      />
      <IconButton size="sm" label="User settings" icon={<LuSettings />} onClick={() => openSettings('account')} />
      <Menu
        label="Status"
        anchor={menu.anchor}
        onClose={menu.close}
        items={[
          ...STATUSES.map((status) => ({
            label: STATUS_LABELS[status],
            icon: <StatusDot status={status} />,
            selected: mine.status === status,
            onSelect: () => update.mutate({ status }),
          })),
          'divider' as const,
          { label: custom ? 'Edit custom status' : 'Set custom status', icon: <LuSmilePlus />, onSelect: () => setEditing(true) },
          ...(custom ? [{ label: 'Clear custom status', icon: <LuX />, onSelect: () => update.mutate({ custom_status: null }) }] : []),
        ]}
      />
      {editing && <CustomStatusDialog open onClose={() => setEditing(false)} current={custom} />}
    </section>
  )
}
