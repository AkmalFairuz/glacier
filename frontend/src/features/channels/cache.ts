import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Channel } from '../../lib/types'

export function upsertChannel(qc: QueryClient, channel: Channel) {
  if (!channel.server_id) return
  qc.setQueryData<Channel[]>(keys.channels(channel.server_id), (list) => {
    if (!list) return list
    return list.some((c) => c.id === channel.id) ? list.map((c) => (c.id === channel.id ? channel : c)) : [...list, channel]
  })
}

export function removeChannel(qc: QueryClient, serverId: string, channelId: string) {
  qc.setQueryData<Channel[]>(keys.channels(serverId), (list) => list?.filter((c) => c.id !== channelId))
  qc.removeQueries({ queryKey: keys.messages(channelId) })
}
