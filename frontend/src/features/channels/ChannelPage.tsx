import { LuHash, LuUsers, LuVolume2 } from 'react-icons/lu'
import { Navigate, useParams } from 'react-router'
import { layout, useLayout } from '../../app/layoutStore'
import { can, Perm } from '../../lib/permissions'
import { IconButton } from '../../ui/IconButton'
import { Spinner } from '../../ui/Spinner'
import { MemberList } from '../members/MemberList'
import { SearchBox } from '../search/SearchBox'
import { SearchPanel } from '../search/SearchPanel'
import { useSearch } from '../search/searchStore'
import { ChatPane } from '../messages/ChatPane'
import { useChannelPermissions } from '../servers/hooks'
import { VoiceStage } from '../voice/VoiceStage'
import { ChannelHeader } from './ChannelHeader'
import { useChannels } from './hooks'
import s from './ChannelPage.module.css'

export function ChannelPage() {
  const { serverId, channelId } = useParams()
  const { data: channels, isLoading } = useChannels(serverId)
  const perms = useChannelPermissions(serverId, channelId)
  const membersOpen = useLayout((st) => st.membersOpen)
  const searching = useSearch((st) => st.scope?.kind === 'server' && st.scope.id === serverId)
  const channel = channels?.find((c) => c.id === channelId)

  if (isLoading) return <Spinner />
  if (!channel) return <Navigate to={`/channels/${serverId}`} replace />

  const isVoice = channel.type === 'voice'
  const name = channel.name ?? ''

  return (
    <main className={s.page}>
      <ChannelHeader
        icon={isVoice ? <LuVolume2 /> : <LuHash />}
        title={name}
        topic={channel.topic}
        search={serverId && <SearchBox scope={{ kind: 'server', id: serverId }} placeholder="Search" />}
        actions={
          !isVoice && (
            <IconButton
              label={membersOpen ? 'Hide members' : 'Show members'}
              icon={<LuUsers />}
              active={membersOpen}
              onClick={layout.toggleMembers}
              tooltipSide="bottom"
            />
          )
        }
      />
      <div className={s.body}>
        {isVoice ? (
          <VoiceStage channelId={channel.id} serverId={channel.server_id} title={name} canConnect={can(perms, Perm.CONNECT)} />
        ) : (
          <ChatPane
            key={channel.id}
            channelId={channel.id}
            title={`Welcome to #${name}`}
            intro={channel.topic ?? `This is the start of the #${name} channel.`}
            placeholder={`Message #${name}`}
            canSend={can(perms, Perm.SEND_MESSAGES)}
            canAttach={can(perms, Perm.ATTACH_FILES)}
            perms={{ canReact: can(perms, Perm.ADD_REACTIONS), canManage: can(perms, Perm.MANAGE_MESSAGES) }}
          />
        )}
        {searching ? <SearchPanel /> : !isVoice && membersOpen && serverId && <MemberList serverId={serverId} />}
      </div>
    </main>
  )
}
