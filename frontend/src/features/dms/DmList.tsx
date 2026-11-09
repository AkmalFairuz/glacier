import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LuLogOut, LuPlus, LuUsers } from 'react-icons/lu'
import { useNavigate, useParams } from 'react-router'
import { layout } from '../../app/layoutStore'
import type { Channel } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { IconButton } from '../../ui/IconButton'
import { ListItem } from '../../ui/ListItem'
import { useChannelUnread } from '../reads/readStore'
import { Menu } from '../../ui/Menu'
import { useMenu } from '../../ui/useMenu'
import { useMe } from '../auth/useSession'
import { useIsOnline } from '../members/presenceStore'
import { dmsApi } from './api'
import { removeDm } from './cache'
import { otherRecipients, useDms, useDmTitle } from './hooks'
import { NewDmModal } from './NewDmModal'
import s from './DmList.module.css'

export function DmList() {
  const { data: dms = [] } = useDms()
  const [creating, setCreating] = useState(false)

  return (
    <div className={s.sidebar}>
      <header className={s.header}>
        <h2 className={s.title}>Direct messages</h2>
        <IconButton label="New message" icon={<LuPlus />} onClick={() => setCreating(true)} tooltipSide="bottom" />
      </header>
      <nav className={s.list} aria-label="Conversations">
        {dms.length === 0 ? (
          <p className={s.none}>No conversations yet</p>
        ) : (
          <ul>
            {dms.map((dm) => (
              <DmItem key={dm.id} channel={dm} />
            ))}
          </ul>
        )}
      </nav>
      <NewDmModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function DmItem({ channel }: { channel: Channel }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { channelId } = useParams()
  const { data: me } = useMe()
  const title = useDmTitle(channel)
  const other = otherRecipients(channel, me?.id)[0]
  const online = useIsOnline(other?.id ?? '', false)
  const menu = useMenu()
  const isGroup = channel.type === 'group_dm'
  const unread = useChannelUnread(channel.id)

  const leave = async () => {
    await dmsApi.leave(channel.id)
    removeDm(qc, channel.id)
    if (channelId === channel.id) navigate('/channels/@me')
  }

  return (
    <li>
      <ListItem
        to={`/channels/@me/${channel.id}`}
        active={channelId === channel.id}
        unread={unread}
        size="tall"
        icon={
          isGroup ? (
            <Avatar name={title} seed={channel.id} size="mid" glyph={<LuUsers />} />
          ) : (
            <Avatar name={title} src={other?.avatar_url} seed={other?.id} size="mid" online={online} />
          )
        }
        label={title}
        description={isGroup ? `${channel.recipients.length} members` : undefined}
        onClick={layout.closeNav}
        onContextMenu={isGroup ? menu.openAtPointer : undefined}
      />
      <Menu
        label={`${title} options`}
        anchor={menu.anchor}
        onClose={menu.close}
        items={[{ label: 'Leave group', icon: <LuLogOut />, danger: true, onSelect: () => void leave() }]}
      />
    </li>
  )
}
