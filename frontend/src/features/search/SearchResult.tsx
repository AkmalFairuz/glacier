import { formatFull } from '../../lib/format'
import type { Message } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { MessageContent } from '../messages/MessageContent'
import s from './SearchPanel.module.css'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function SearchResult({ message, channelName, onOpen }: { message: Message; channelName?: string | null; onOpen: () => void }) {
  return (
    <article className={s.result}>
      {channelName && <p className={s.channel}>#{channelName}</p>}
      <button type="button" className={s.card} onClick={onOpen} aria-label={`Jump to message from ${message.author.display_name}`}>
        <Avatar name={message.author.display_name} src={message.author.avatar_url} seed={message.author.id} size="sm" />
        <div className={s.body}>
          <p className={s.meta}>
            <span className={s.author}>{message.author.display_name}</span>
            <time dateTime={message.created_at} title={formatFull(message.created_at)}>
              {dateFmt.format(new Date(message.created_at))}
            </time>
          </p>
          <MessageContent content={message.content || (message.attachments.length ? 'Sent an attachment' : '')} edited={false} />
        </div>
      </button>
    </article>
  )
}
