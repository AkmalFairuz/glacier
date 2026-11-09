import { LuHeadphoneOff, LuHeadphones, LuMic, LuMicOff, LuSettings } from 'react-icons/lu'
import { Avatar } from '../../ui/Avatar'
import { IconButton } from '../../ui/IconButton'
import { useMe } from '../auth/useSession'
import { voiceActions } from '../voice/useVoiceRoom'
import { useVoice } from '../voice/voiceStore'
import { openSettings } from '../settings/settingsWindow'
import s from './UserPanel.module.css'

export function UserPanel() {
  const { data: me } = useMe()
  const muted = useVoice((st) => st.muted)
  const deafened = useVoice((st) => st.deafened)
  if (!me) return null

  return (
    <section className={s.panel} aria-label="Your account">
      <Avatar name={me.display_name} src={me.avatar_url} seed={me.id} size="sm" online />
      <div className={s.names}>
        <p className={s.display}>{me.display_name}</p>
        <p className={s.username}>@{me.username}</p>
      </div>
      <IconButton size="sm" label={muted ? 'Unmute' : 'Mute'} icon={muted ? <LuMicOff /> : <LuMic />} active={muted} onClick={voiceActions.toggleMute} />
      <IconButton
        size="sm"
        label={deafened ? 'Undeafen' : 'Deafen'}
        icon={deafened ? <LuHeadphoneOff /> : <LuHeadphones />}
        active={deafened}
        onClick={voiceActions.toggleDeafen}
      />
      <IconButton size="sm" label="User settings" icon={<LuSettings />} onClick={() => openSettings('account')} />
    </section>
  )
}
