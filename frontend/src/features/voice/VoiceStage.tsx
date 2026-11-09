import { LuPhone, LuVideo } from 'react-icons/lu'
import { Button } from '../../ui/Button'
import { useMe } from '../auth/useSession'
import { useSettings } from '../settings/settingsStore'
import { useSpeaking } from './speaking'
import { joinVoice, useRoomUsers, useVoiceRoom } from './useVoiceRoom'
import { useVoice } from './voiceStore'
import { VideoTile } from './VideoTile'
import { VoiceControls } from './VoiceControls'
import s from './VoiceStage.module.css'

type Props = { channelId: string; serverId: string | null; title: string; canConnect: boolean }

export function VoiceStage({ channelId, serverId, title, canConnect }: Props) {
  const { data: me } = useMe()
  const room = useVoiceRoom(channelId)
  const lookup = useRoomUsers(serverId)
  const remote = useVoice((st) => st.remote)
  const localMain = useVoice((st) => st.localMain)
  const localScreen = useVoice((st) => st.localScreen)
  const version = useVoice((st) => st.mediaVersion)
  const speaking = useSpeaking()
  const mirrorSelf = useSettings((st) => st.mirrorVideo)
  const showNonVideo = useSettings((st) => st.showNonVideo)

  if (!room.connected) {
    const names = room.participants.map((p) => lookup(p.user_id)?.display_name ?? 'Someone')
    return (
      <section className={s.lobby}>
        <h2 className={s.title}>{title}</h2>
        <p className={s.muted}>{names.length ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} here.` : 'Nobody is here yet.'}</p>
        {canConnect ? (
          <div className={s.actions}>
            <Button variant="primary" icon={<LuPhone />} onClick={() => void joinVoice(channelId, serverId)}>
              Join voice
            </Button>
            <Button icon={<LuVideo />} onClick={() => void joinVoice(channelId, serverId, { video: true })}>
              Join with camera
            </Button>
          </div>
        ) : (
          <p className={s.muted}>You do not have permission to connect to this channel.</p>
        )}
      </section>
    )
  }

  return (
    <section className={s.stage} aria-label={`${title} call`}>
      <div className={s.grid}>
        {room.participants.flatMap((p) => {
          const user = lookup(p.user_id)
          const name = user?.display_name ?? 'Unknown'
          const isMe = p.user_id === me?.id
          const media = remote[p.user_id]
          const main = isMe ? localMain : (media?.streams.find((st) => st.id !== media.screenId) ?? null)
          const screen = isMe ? localScreen : (media?.streams.find((st) => st.id === media.screenId) ?? null)
          const showMain = showNonVideo || p.video || room.participants.every((x) => !x.video && !x.screen)
          return [
            ...(showMain
              ? [
                  <VideoTile
                    key={p.user_id}
                    name={name}
                    avatarUrl={user?.avatar_url}
                    seed={p.user_id}
                    stream={main}
                    muted={p.muted}
                    speaking={speaking[p.user_id]}
                    mirror={isMe && mirrorSelf}
                    version={version}
                  />,
                ]
              : []),
            ...(p.screen && screen ? [<VideoTile key={`${p.user_id}-screen`} name={name} stream={screen} isScreen version={version} />] : []),
          ]
        })}
      </div>
      <VoiceControls />
    </section>
  )
}
