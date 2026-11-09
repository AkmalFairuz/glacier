import { LuHeadphoneOff, LuMicOff, LuMonitor, LuVideo } from 'react-icons/lu'
import { Avatar } from '../../ui/Avatar'
import { openProfileCard } from '../profile/profileStore'
import { useSpeaking } from './speaking'
import { useRoomUsers } from './useVoiceRoom'
import { useRoomStates } from './voiceStore'
import s from './VoiceUserList.module.css'

export function VoiceUserList({ channelId, serverId = null }: { channelId: string; serverId?: string | null }) {
  const states = useRoomStates(channelId)
  const lookup = useRoomUsers(serverId)
  const speaking = useSpeaking()
  if (!states.length) return null

  return (
    <ul className={s.list} aria-label="Connected">
      {states.map((v) => {
        const user = lookup(v.user_id)
        const name = user?.display_name ?? 'Unknown'
        return (
          <li key={v.user_id} className={speaking[v.user_id] ? `${s.user} ${s.speaking}` : s.user}>
            <button type="button" className={s.person} onClick={(e) => openProfileCard(v.user_id, serverId, e.currentTarget)}>
              <Avatar name={name} src={user?.avatar_url} seed={v.user_id} size="xs" />
              <span className={s.name}>{name}</span>
            </button>
            <span className={s.flags}>
              {v.screen && <LuMonitor title="Sharing screen" />}
              {v.video && <LuVideo title="Camera on" />}
              {v.deafened ? <LuHeadphoneOff title="Deafened" /> : v.muted && <LuMicOff title="Muted" />}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
