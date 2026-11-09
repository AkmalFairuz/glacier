import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import { membersApi } from './api'

export function useMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: keys.members(serverId ?? ''),
    queryFn: () => membersApi.list(serverId!),
    enabled: !!serverId,
  })
}

export function useBans(serverId: string) {
  return useQuery({ queryKey: keys.bans(serverId), queryFn: () => membersApi.bans(serverId) })
}
