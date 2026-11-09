import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Server } from '../../lib/types'

export function upsertServer(qc: QueryClient, server: Server) {
  qc.setQueryData<Server[]>(keys.servers, (list) => {
    if (!list) return list
    return list.some((s) => s.id === server.id) ? list.map((s) => (s.id === server.id ? server : s)) : [...list, server]
  })
}

export function removeServer(qc: QueryClient, id: string) {
  qc.setQueryData<Server[]>(keys.servers, (list) => list?.filter((s) => s.id !== id))
  for (const key of [keys.channels(id), keys.members(id), keys.roles(id), keys.permissions(id), keys.bans(id), keys.invites(id)]) {
    qc.removeQueries({ queryKey: key })
  }
}

export function adjustMemberCount(qc: QueryClient, serverId: string, delta: number) {
  qc.setQueryData<Server[]>(keys.servers, (list) => list?.map((s) => (s.id === serverId ? { ...s, member_count: Math.max(0, s.member_count + delta) } : s)))
}
