import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import { useSession } from '../auth/useSession'
import { serversApi } from './api'

export function useServers() {
  const token = useSession((s) => s.token)
  return useQuery({ queryKey: keys.servers, queryFn: serversApi.list, enabled: token !== null })
}

export function useServer(serverId: string | undefined) {
  const { data } = useServers()
  return data?.find((server) => server.id === serverId)
}

export function usePermissions(serverId: string | undefined) {
  return useQuery({
    queryKey: keys.permissions(serverId ?? ''),
    queryFn: () => serversApi.permissions(serverId!),
    enabled: !!serverId,
  })
}

/** Effective permission bits for one channel, falling back to server-level bits. */
export function useChannelPermissions(serverId: string | undefined, channelId: string | undefined): number | undefined {
  const { data } = usePermissions(serverId)
  if (!data) return undefined
  return channelId !== undefined && channelId in data.channels ? data.channels[channelId] : data.server
}
