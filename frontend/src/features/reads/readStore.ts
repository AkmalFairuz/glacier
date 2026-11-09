import { create } from 'zustand'
import type { ChannelHead, ReadState } from '../../lib/gateway'
import { compareIds } from '../../lib/format'
import type { Channel } from '../../lib/types'

type Head = { serverId: string | null; lastMessageId: string }

type Reads = {
  /** channel id -> last message the user has read */
  read: Record<string, string>
  /** channel id -> newest message in that channel */
  heads: Record<string, Head>
  /** DM channel id -> messages from others not read yet */
  counts: Record<string, number>
  /** True once READY delivered the read states. */
  hydrated: boolean
}

export const useReads = create<Reads>(() => ({ read: {}, heads: {}, counts: {}, hydrated: false }))

const newer = (a: string | undefined, b: string) => (a && compareIds(a, b) >= 0 ? a : b)

export const reads = {
  hydrate(readStates: ReadState[], heads: ChannelHead[], dms: Channel[], counts: { channel_id: string; count: number }[]) {
    useReads.setState({
      hydrated: true,
      counts: Object.fromEntries(counts.map((c) => [c.channel_id, c.count])),
      read: Object.fromEntries(readStates.map((r) => [r.channel_id, r.last_read_message_id])),
      heads: Object.fromEntries([
        ...heads.map((h) => [h.channel_id, { serverId: h.server_id, lastMessageId: h.last_message_id }] as const),
        ...dms.filter((d) => d.last_message_id).map((d) => [d.id, { serverId: null, lastMessageId: d.last_message_id! }] as const),
      ]),
    })
  },
  setRead(channelId: string, messageId: string) {
    useReads.setState((s) => {
      const read = newer(s.read[channelId], messageId)
      const head = s.heads[channelId]?.lastMessageId
      const caughtUp = !head || compareIds(read, head) >= 0
      return { read: { ...s.read, [channelId]: read }, counts: caughtUp ? { ...s.counts, [channelId]: 0 } : s.counts }
    })
  },
  /** One more unread DM message, unless the reader is looking at that DM right now. */
  countDm(channelId: string) {
    if (document.hasFocus() && location.pathname.endsWith(`/${channelId}`)) return
    useReads.setState((s) => ({ counts: { ...s.counts, [channelId]: Math.min(100, (s.counts[channelId] ?? 0) + 1) } }))
  },
  bumpHead(channelId: string, serverId: string | null, messageId: string) {
    useReads.setState((s) => ({
      heads: {
        ...s.heads,
        [channelId]: { serverId: s.heads[channelId]?.serverId ?? serverId, lastMessageId: newer(s.heads[channelId]?.lastMessageId, messageId) },
      },
    }))
  },
}

export function isUnread(state: Reads, channelId: string): boolean {
  const head = state.heads[channelId]
  if (!head) return false
  const read = state.read[channelId]
  return !read || compareIds(head.lastMessageId, read) > 0
}

export const useChannelUnread = (channelId: string) => useReads((s) => isUnread(s, channelId))

export const useServerUnread = (serverId: string) => useReads((s) => Object.entries(s.heads).some(([id, h]) => h.serverId === serverId && isUnread(s, id)))
