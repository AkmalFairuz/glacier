import { create } from 'zustand'
import type { Message } from '../../lib/types'

/** The message being replied to, per channel. */
export const useReply = create<Record<string, Message | undefined>>(() => ({}))

export const reply = {
  start: (message: Message) => useReply.setState({ [message.channel_id]: message }),
  cancel: (channelId: string) => useReply.setState({ [channelId]: undefined }),
}
