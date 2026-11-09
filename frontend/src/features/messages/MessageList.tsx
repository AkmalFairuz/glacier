import { useEffect, useMemo, useRef, useState } from 'react'
import { compareIds } from '../../lib/format'
import { Button } from '../../ui/Button'
import { useDm } from '../dms/hooks'
import { readsApi } from '../reads/api'
import { reads, useChannelUnread, useReads } from '../reads/readStore'
import { useAutoAck } from '../reads/useAutoAck'
import { useSeen } from '../reads/useSeen'
import { Spinner } from '../../ui/Spinner'
import { useMe } from '../auth/useSession'
import { groupMessages } from './grouping'
import { useMessages } from './hooks'
import { MessageGroup } from './MessageGroup'
import type { MessagePerms } from './MessageItem'
import s from './MessageList.module.css'

type Props = {
  channelId: string
  title: string
  intro: string
  perms: MessagePerms
}

export function MessageList({ channelId, title, intro, perms }: Props) {
  const { data: me } = useMe()
  const { data: messages = [], fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMessages(channelId)
  const sentinel = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  // Where the reader was when the channel opened (once read states have loaded); the divider stays put after that.
  const hydrated = useReads((st) => st.hydrated)
  const [initialRead, setInitialRead] = useState<string | null>(() => (hydrated ? (useReads.getState().read[channelId] ?? '') : null))
  if (initialRead === null && hydrated) setInitialRead(useReads.getState().read[channelId] ?? '')
  const unreadFrom = useMemo(
    () => (initialRead === null ? undefined : messages.find((m) => compareIds(m.id, initialRead || '0') > 0 && m.author.id !== me?.id)?.id),
    [messages, initialRead, me?.id],
  )
  const blocks = useMemo(() => groupMessages(messages, unreadFrom), [messages, unreadFrom])
  const newest = messages.at(-1)?.id
  const unread = useChannelUnread(channelId)
  const seen = useSeen(useDm(channelId), messages, me?.id)
  useAutoAck(channelId, newest, atBottom)

  const markRead = () => {
    const head = useReads.getState().heads[channelId]?.lastMessageId ?? newest
    if (!head) return
    reads.setRead(channelId, head)
    void readsApi.ack(channelId, head)
  }

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className={s.wrap}>
      {unread && !atBottom && (
        <div className={s.unreadBar} role="status">
          <span>You have unread messages</span>
          <Button size="sm" variant="ghost" onClick={markRead}>
            Mark as read
          </Button>
        </div>
      )}
      <div
        className={s.scroller}
        tabIndex={0}
        aria-label={`Messages in ${title}`}
        // column-reverse: the bottom of the conversation is scrollTop 0.
        onScroll={(e) => setAtBottom(e.currentTarget.scrollTop > -48)}
      >
        <div className={s.content} role="log" aria-live="polite">
          {hasNextPage ? (
            <div ref={sentinel} className={s.loading}>
              <Spinner label="Loading older messages" />
            </div>
          ) : (
            !isLoading && (
              <header className={s.intro}>
                <h2 className={s.introTitle}>{title}</h2>
                <p className={s.introBody}>{intro}</p>
              </header>
            )
          )}
          {isLoading && (
            <div className={s.loading}>
              <Spinner />
            </div>
          )}
          {blocks.map((block) => (
            <MessageGroup key={block.messages[0].id} block={block} meId={me?.id} perms={perms} />
          ))}
          {seen && (
            <p className={s.seen} title={seen.names}>
              {seen.label}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
