import { LuVolume2 } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import type { VoiceState } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { useChannels } from '../channels/hooks'
import { useDms } from '../dms/hooks'
import { useServers } from '../servers/hooks'
import { useRoomUsers } from '../voice/useVoiceRoom'
import { useRoomStates } from '../voice/voiceStore'
import s from './VoiceActivity.module.css'

const STACK = 3

/** "In voice" block: where the user is talking and who is with them. */
export function VoiceActivity({ state, onOpen }: { state: VoiceState; onOpen?: () => void }) {
  const navigate = useNavigate()
  const channel = useChannels(state.server_id ?? undefined).data?.find((c) => c.id === state.channel_id)
  const dm = useDms().data?.find((c) => c.id === state.channel_id)
  const server = useServers().data?.find((x) => x.id === state.server_id)
  const room = useRoomStates(state.channel_id)
  const lookup = useRoomUsers(state.server_id)
  const where = channel?.name ?? (dm ? 'Call' : 'Voice channel')
  const context = server?.name ?? (dm ? 'Direct messages' : null)
  const href = state.server_id ? `/channels/${state.server_id}/${state.channel_id}` : `/channels/@me/${state.channel_id}`

  return (
    <section className={s.card} aria-label="In voice">
      <div className={s.stack} aria-hidden="true">
        {room.slice(0, STACK).map((v) => {
          const u = lookup(v.user_id)
          return <Avatar key={v.user_id} name={u?.display_name ?? '?'} src={u?.avatar_url} seed={v.user_id} size="sm" />
        })}
        {room.length > STACK && <span className={s.more}>+{room.length - STACK}</span>}
      </div>
      <div className={s.text}>
        <p className={s.where}>
          <LuVolume2 aria-hidden="true" />
          {where}
        </p>
        {context && <p className={s.context}>in {context}</p>}
      </div>
      <Button
        size="sm"
        onClick={() => {
          onOpen?.()
          navigate(href)
        }}
      >
        Open
      </Button>
    </section>
  )
}
