import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { ReactionEvent } from '../../lib/gateway'
import { keys } from '../../lib/keys'
import type { Message } from '../../lib/types'
import { markFresh } from './freshMessages'

type Pages = InfiniteData<Message[], string | null>

function patch(qc: QueryClient, channelId: string, fn: (pages: Message[][]) => Message[][]) {
  qc.setQueryData<Pages>(keys.messages(channelId), (data) => data && { ...data, pages: fn(data.pages) })
}

const mapMessage = (pages: Message[][], id: string, fn: (m: Message) => Message) =>
  pages.map((page) => (page.some((m) => m.id === id) ? page.map((m) => (m.id === id ? fn(m) : m)) : page))

export function addMessage(qc: QueryClient, message: Message) {
  markFresh(message.id)
  patch(qc, message.channel_id, (pages) => {
    if (pages.some((page) => page.some((m) => m.id === message.id))) return mapMessage(pages, message.id, () => message)
    const [newest = [], ...rest] = pages
    return [[...newest, message], ...rest]
  })
}

/** Applies `fn` to the quoted copy in every loaded reply to `originalId`. */
const mapReplies = (pages: Message[][], originalId: string, fn: (ref: Message['referenced_message']) => Message['referenced_message']) =>
  pages.map((page) =>
    page.some((m) => m.reply_to_id === originalId)
      ? page.map((m) => (m.reply_to_id === originalId ? { ...m, referenced_message: fn(m.referenced_message) } : m))
      : page,
  )

export function updateMessage(qc: QueryClient, message: Message) {
  patch(qc, message.channel_id, (pages) =>
    mapReplies(
      mapMessage(pages, message.id, () => message),
      message.id,
      (ref) => ref && { ...ref, content: message.content.slice(0, 200), has_attachments: message.attachments.length > 0 },
    ),
  )
}

export function deleteMessage(qc: QueryClient, channelId: string, id: string) {
  patch(qc, channelId, (pages) =>
    mapReplies(
      pages.map((page) => page.filter((m) => m.id !== id)),
      id,
      () => null,
    ),
  )
}

export function applyReaction(qc: QueryClient, e: ReactionEvent, added: boolean) {
  patch(qc, e.channel_id, (pages) =>
    mapMessage(pages, e.message_id, (m) => {
      const existing = m.reactions.find((r) => r.emoji === e.emoji)
      const others = (existing?.user_ids ?? []).filter((id) => id !== e.user_id)
      const userIds = added ? [...others, e.user_id] : others
      const reactions = existing
        ? m.reactions.map((r) => (r.emoji === e.emoji ? { ...r, user_ids: userIds } : r))
        : [...m.reactions, { emoji: e.emoji, user_ids: userIds }]
      return { ...m, reactions: reactions.filter((r) => r.user_ids.length > 0) }
    }),
  )
}
