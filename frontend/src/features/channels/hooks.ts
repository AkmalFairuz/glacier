import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Channel } from '../../lib/types'
import { channelsApi } from './api'

export function useChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: keys.channels(serverId ?? ''),
    queryFn: () => channelsApi.list(serverId!),
    enabled: !!serverId,
  })
}

export type ChannelGroup = { category: Channel | null; channels: Channel[] }

/** Uncategorised channels first, then each category with its children, all by position. */
export function groupChannels(channels: Channel[]): ChannelGroup[] {
  const byPosition = (a: Channel, b: Channel) => a.position - b.position
  const sorted = [...channels].sort(byPosition)
  const categories = sorted.filter((c) => c.type === 'category')
  const loose = sorted.filter((c) => c.type !== 'category' && !categories.some((cat) => cat.id === c.parent_id))
  return [
    ...(loose.length ? [{ category: null, channels: loose }] : []),
    ...categories.map((category) => ({ category, channels: sorted.filter((c) => c.parent_id === category.id && c.type !== 'category') })),
  ]
}
