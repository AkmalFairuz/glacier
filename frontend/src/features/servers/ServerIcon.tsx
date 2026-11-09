import { NavLink } from 'react-router'
import type { Server } from '../../lib/types'
import { Tooltip } from '../../ui/Tooltip'
import { Avatar } from '../../ui/Avatar'
import { useServerUnread } from '../reads/readStore'
import s from './ServerIcon.module.css'

export function ServerIcon({ server }: { server: Server }) {
  const unread = useServerUnread(server.id)
  return (
    <Tooltip label={server.name} side="right">
      <NavLink
        to={`/channels/${server.id}`}
        className={({ isActive }) => [s.icon, isActive && s.active, unread && s.unread].filter(Boolean).join(' ')}
        aria-label={server.name}
      >
        <Avatar name={server.name} src={server.icon_url} seed={server.id} size="lg" />
      </NavLink>
    </Tooltip>
  )
}
