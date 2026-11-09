import { isSameDay } from '../../lib/format'
import type { Message } from '../../lib/types'

const GROUP_WINDOW_MS = 7 * 60 * 1000

/** `unread` marks the block that starts at the first unread message. */
export type MessageBlock = { day: string | null; unread: boolean; messages: Message[] }

/** Splits a chronological list into author runs, marking the first block of each day. */
export function groupMessages(messages: Message[], unreadFrom?: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let previous: Message | undefined
  for (const message of messages) {
    const newDay = !previous || !isSameDay(previous.created_at, message.created_at)
    const startsUnread = message.id === unreadFrom
    const sameRun =
      previous &&
      !newDay &&
      !startsUnread &&
      // A reply starts its own group so the quoted line sits above the author.
      !message.reply_to_id &&
      previous.author.id === message.author.id &&
      new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < GROUP_WINDOW_MS
    if (sameRun) blocks[blocks.length - 1].messages.push(message)
    else blocks.push({ day: newDay ? message.created_at : null, unread: startsUnread, messages: [message] })
    previous = message
  }
  return blocks
}
