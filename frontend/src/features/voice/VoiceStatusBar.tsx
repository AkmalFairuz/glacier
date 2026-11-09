import { LuPhoneOff, LuVideo, LuVideoOff } from 'react-icons/lu'
import { Link } from 'react-router'
import { useChannels } from '../channels/hooks'
import { useDms } from '../dms/hooks'
import { IconButton } from '../../ui/IconButton'
import { ScreenShareButton } from './ScreenShareButton'
import { voiceActions } from './useVoiceRoom'
import { useVoice } from './voiceStore'
import s from './VoiceStatusBar.module.css'

export function VoiceStatusBar() {
  const session = useVoice((st) => st.session)
  const video = useVoice((st) => st.video)
  const serverChannels = useChannels(session?.serverId ?? undefined).data
  const dms = useDms().data
  const channels = session?.serverId ? serverChannels : dms
  if (!session) return null

  const channel = channels?.find((c) => c.id === session.channelId)
  const name = channel?.name ?? channel?.recipients.map((u) => u.display_name).join(', ') ?? 'Call'
  const href = session.serverId ? `/channels/${session.serverId}/${session.channelId}` : `/channels/@me/${session.channelId}`

  return (
    <section className={s.bar} aria-label="Voice connection">
      <div className={s.info}>
        <p className={s.status}>Voice connected</p>
        <Link to={href} className={s.channel}>
          {name}
        </Link>
      </div>
      <IconButton
        size="sm"
        label={video ? 'Turn camera off' : 'Turn camera on'}
        icon={video ? <LuVideo /> : <LuVideoOff />}
        active={video}
        onClick={voiceActions.toggleVideo}
      />
      <ScreenShareButton size="sm" />
      <IconButton size="sm" danger label="Disconnect" icon={<LuPhoneOff />} onClick={voiceActions.leave} />
    </section>
  )
}
