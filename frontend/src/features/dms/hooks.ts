import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Channel, User } from '../../lib/types'
import { useMe } from '../auth/useSession'
import { dmsApi } from './api'

export function useDms() {
  return useQuery({ queryKey: keys.dms, queryFn: dmsApi.list })
}

export function useDm(channelId: string | undefined) {
  return useDms().data?.find((c) => c.id === channelId)
}

export function otherRecipients(channel: Channel, meId: string | undefined): User[] {
  const others = channel.recipients.filter((u) => u.id !== meId)
  return others.length ? others : channel.recipients
}

export function useDmTitle(channel: Channel | undefined): string {
  const { data: me } = useMe()
  if (!channel) return ''
  if (channel.name) return channel.name
  return otherRecipients(channel, me?.id)
    .map((u) => u.display_name)
    .join(', ')
}
