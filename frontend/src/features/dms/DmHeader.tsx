import { useState } from 'react'
import { LuAtSign, LuPhone, LuUserPlus, LuUsers, LuVideo } from 'react-icons/lu'
import type { Channel } from '../../lib/types'
import { IconButton } from '../../ui/IconButton'
import { ChannelHeader } from '../channels/ChannelHeader'
import { SearchBox } from '../search/SearchBox'
import { joinVoice } from '../voice/useVoiceRoom'
import { useVoice } from '../voice/voiceStore'
import { useDmTitle } from './hooks'
import { NewDmModal } from './NewDmModal'

export function DmHeader({ channel }: { channel: Channel }) {
  const title = useDmTitle(channel)
  const inCall = useVoice((s) => s.session?.channelId === channel.id)
  const [adding, setAdding] = useState(false)
  const isGroup = channel.type === 'group_dm'

  return (
    <>
      <ChannelHeader
        icon={isGroup ? <LuUsers /> : <LuAtSign />}
        title={title}
        topic={isGroup ? `${channel.recipients.length} members` : null}
        search={<SearchBox scope={{ kind: 'channel', id: channel.id }} placeholder={`Search ${title}`} />}
        actions={
          <>
            <IconButton label="Start voice call" icon={<LuPhone />} disabled={inCall} onClick={() => void joinVoice(channel.id, null)} tooltipSide="bottom" />
            <IconButton
              label="Start video call"
              icon={<LuVideo />}
              disabled={inCall}
              onClick={() => void joinVoice(channel.id, null, { video: true })}
              tooltipSide="bottom"
            />
            {isGroup && <IconButton label="Add people" icon={<LuUserPlus />} onClick={() => setAdding(true)} tooltipSide="bottom" />}
          </>
        }
      />
      {isGroup && <NewDmModal open={adding} onClose={() => setAdding(false)} group={channel} />}
    </>
  )
}
