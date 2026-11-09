import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Role } from '../../lib/types'

export function upsertRole(qc: QueryClient, role: Role) {
  qc.setQueryData<Role[]>(keys.roles(role.server_id), (list) => {
    if (!list) return list
    return list.some((r) => r.id === role.id) ? list.map((r) => (r.id === role.id ? role : r)) : [...list, role]
  })
}

export function removeRole(qc: QueryClient, serverId: string, roleId: string) {
  qc.setQueryData<Role[]>(keys.roles(serverId), (list) => list?.filter((r) => r.id !== roleId))
}
