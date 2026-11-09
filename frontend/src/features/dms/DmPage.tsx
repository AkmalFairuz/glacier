import { Navigate, useParams } from 'react-router'
import { Spinner } from '../../ui/Spinner'
import { ChatPane } from '../messages/ChatPane'
import { SearchPanel } from '../search/SearchPanel'
import { useSearch } from '../search/searchStore'
import { VoiceStage } from '../voice/VoiceStage'
import { useRoomStates, useVoice } from '../voice/voiceStore'
import { DmHeader } from './DmHeader'
import { useDms, useDmTitle } from './hooks'
import s from './DmPage.module.css'

const DM_PERMS = { canReact: true, canManage: false }

export function DmPage() {
  const { channelId } = useParams()
  const { data: dms, isLoading } = useDms()
  const channel = dms?.find((c) => c.id === channelId)
  const title = useDmTitle(channel)
  const callActive = useRoomStates(channelId ?? '').length > 0
  const inCall = useVoice((st) => st.session?.channelId === channelId)
  const searching = useSearch((st) => st.scope?.kind === 'channel' && st.scope.id === channelId)

  if (isLoading) return <Spinner />
  if (!channel) return <Navigate to="/channels/@me" replace />

  return (
    <main className={s.page}>
      <DmHeader channel={channel} />
      {(callActive || inCall) && (
        <div className={s.call}>
          <VoiceStage channelId={channel.id} serverId={null} title={inCall ? title : 'A call is in progress'} canConnect />
        </div>
      )}
      <div className={s.body}>
        <ChatPane
          key={channel.id}
          channelId={channel.id}
          title={title}
          intro={channel.type === 'group_dm' ? 'This is the start of the group.' : `This is the start of your conversation with ${title}.`}
          placeholder={`Message ${title}`}
          canSend
          canAttach
          perms={DM_PERMS}
        />
        {searching && <SearchPanel />}
      </div>
    </main>
  )
}
