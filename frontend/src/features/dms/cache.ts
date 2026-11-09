import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Channel } from '../../lib/types'

export function upsertDm(qc: QueryClient, channel: Channel) {
  qc.setQueryData<Channel[]>(keys.dms, (list) => {
    if (!list) return list
    const rest = list.filter((c) => c.id !== channel.id)
    return [channel, ...rest]
  })
}

export function removeDm(qc: QueryClient, channelId: string) {
  qc.setQueryData<Channel[]>(keys.dms, (list) => list?.filter((c) => c.id !== channelId))
  qc.removeQueries({ queryKey: keys.messages(channelId) })
}

/** Moves a DM to the top when it receives a message. */
export function bumpDm(qc: QueryClient, channelId: string, messageId: string) {
  qc.setQueryData<Channel[]>(keys.dms, (list) => {
    const channel = list?.find((c) => c.id === channelId)
    if (!list || !channel) return list
    return [{ ...channel, last_message_id: messageId }, ...list.filter((c) => c.id !== channelId)]
  })
}
