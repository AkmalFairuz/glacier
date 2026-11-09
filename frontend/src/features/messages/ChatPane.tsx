import { Composer } from './Composer'
import type { MessagePerms } from './MessageItem'
import { MessageList } from './MessageList'
import { TypingIndicator } from './TypingIndicator'
import s from './ChatPane.module.css'

type Props = {
  channelId: string
  title: string
  intro: string
  placeholder: string
  canSend: boolean
  canAttach: boolean
  perms: MessagePerms
}

export function ChatPane({ channelId, title, intro, placeholder, canSend, canAttach, perms }: Props) {
  return (
    <section className={s.pane}>
      <MessageList key={channelId} channelId={channelId} title={title} intro={intro} perms={perms} />
      <div className={s.footer}>
        <TypingIndicator channelId={channelId} />
        <Composer key={`composer-${channelId}`} channelId={channelId} placeholder={placeholder} canSend={canSend} canAttach={canAttach} />
      </div>
    </section>
  )
}
