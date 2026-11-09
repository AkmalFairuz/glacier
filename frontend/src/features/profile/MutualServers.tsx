import type { Server } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { openFullProfile } from './profileStore'
import s from './MutualServers.module.css'

/** "N mutual servers" with a small stack of their icons; opens that tab of the full profile. */
export function MutualServers({ userId, serverId, servers }: { userId: string; serverId: string | null; servers: Server[] }) {
  if (!servers.length) return null
  return (
    <button type="button" className={s.line} onClick={() => openFullProfile(userId, serverId, 'servers')}>
      <span className={s.stack} aria-hidden="true">
        {servers.slice(0, 3).map((server) => (
          <Avatar key={server.id} name={server.name} src={server.icon_url} seed={server.id} size="xs" />
        ))}
      </span>
      {servers.length} mutual {servers.length === 1 ? 'server' : 'servers'}
    </button>
  )
}
