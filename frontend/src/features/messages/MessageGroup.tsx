import type { MouseEvent } from 'react'
import { useParams } from 'react-router'
import { formatDay, formatFull } from '../../lib/format'
import { openProfileCard } from '../profile/profileStore'
import { useTimeFormat } from '../settings/useTimeFormat'
import { Avatar } from '../../ui/Avatar'
import { Divider } from '../../ui/Divider'
import type { MessageBlock } from './grouping'
import { isFresh } from './freshMessages'
import { MessageItem, type MessagePerms } from './MessageItem'
import { ReplyPreview } from './ReplyPreview'
import s from './MessageGroup.module.css'

type Props = { block: MessageBlock; meId: string | undefined; perms: MessagePerms }

export function MessageGroup({ block, meId, perms }: Props) {
  const [first] = block.messages
  const { author } = first
  const formatTime = useTimeFormat()
  const { serverId } = useParams()
  const openProfile = (e: MouseEvent<HTMLElement>) => openProfileCard(author.id, serverId ?? null, e.currentTarget)
  return (
    <>
      {block.day && <Divider label={formatDay(block.day)} />}
      {block.unread && <Divider label="New messages" tone="danger" />}
      <article className={isFresh(first.id) ? `${s.group} ${s.fresh}` : s.group}>
        {first.reply_to_id && <ReplyPreview message={first} />}
        <button type="button" className={s.avatar} aria-label={`View ${author.display_name}’s profile`} onClick={openProfile}>
          <Avatar name={author.display_name} src={author.avatar_url} seed={author.id} />
        </button>
        <div className={s.body}>
          <header className={s.header}>
            <h3 className={s.author}>
              <button type="button" className={s.authorButton} onClick={openProfile}>
                {author.display_name}
              </button>
            </h3>
            <time className={s.time} dateTime={first.created_at} title={formatFull(first.created_at)}>
              {formatTime(first.created_at)}
            </time>
          </header>
          {block.messages.map((message, i) => (
            <MessageItem key={message.id} message={message} meId={meId} perms={perms} compact={i > 0} />
          ))}
        </div>
      </article>
    </>
  )
}
