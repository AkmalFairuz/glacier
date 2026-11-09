import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Role } from '../../lib/types'
import { rolesApi } from './api'

const byPosition = (a: Role, b: Role) => (a.is_default ? 1 : b.is_default ? -1 : b.position - a.position)

export function useRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: keys.roles(serverId ?? ''),
    queryFn: () => rolesApi.list(serverId!),
    enabled: !!serverId,
    select: (roles) => [...roles].sort(byPosition),
  })
}

/** Highest-positioned role with a color, used to tint member names. */
export function topColoredRole(roles: Role[], roleIds: string[]): Role | undefined {
  return roles.find((r) => !r.is_default && r.color !== null && roleIds.includes(r.id))
}
