import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Member } from '../../lib/types'

export function upsertMember(qc: QueryClient, member: Member) {
  qc.setQueryData<Member[]>(keys.members(member.server_id), (list) => {
    if (!list) return list
    return list.some((m) => m.user.id === member.user.id) ? list.map((m) => (m.user.id === member.user.id ? member : m)) : [...list, member]
  })
}

export function removeMember(qc: QueryClient, serverId: string, userId: string) {
  qc.setQueryData<Member[]>(keys.members(serverId), (list) => list?.filter((m) => m.user.id !== userId))
}
