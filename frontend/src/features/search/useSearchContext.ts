import type { Channel, User } from '../../lib/types'
import { useChannels } from '../channels/hooks'
import { useDms } from '../dms/hooks'
import { useMembers } from '../members/hooks'
import type { SearchScope } from './searchStore'

/** People and channels a query's from:/in: filters can refer to in this scope. */
export function useSearchContext(scope: SearchScope): { users: User[]; channels: Channel[] } {
  const serverId = scope.kind === 'server' ? scope.id : undefined
  const members = useMembers(serverId).data ?? []
  const channels = useChannels(serverId).data ?? []
  const dm = useDms().data?.find((c) => c.id === scope.id)
  return scope.kind === 'server'
    ? { users: members.map((m) => m.user), channels: channels.filter((c) => c.type === 'text') }
    : { users: dm?.recipients ?? [], channels: [] }
}
