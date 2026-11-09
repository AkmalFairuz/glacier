import { useState } from 'react'
import { LuCompass, LuPlus } from 'react-icons/lu'
import { NavLink } from 'react-router'
import { GlacierMark } from '../../ui/GlacierMark'
import { Tooltip } from '../../ui/Tooltip'
import { DmRailBadges } from '../dms/DmRailBadges'
import { CreateServerModal } from './CreateServerModal'
import { useServers } from './hooks'
import { ServerIcon } from './ServerIcon'
import s from './ServerRail.module.css'

const railLink = ({ isActive }: { isActive: boolean }) => (isActive ? `${s.action} ${s.active}` : s.action)

export function ServerRail() {
  const { data: servers = [] } = useServers()
  const [creating, setCreating] = useState(false)

  return (
    <nav className={s.rail} aria-label="Servers">
      <Tooltip label="Direct messages" side="right">
        <NavLink to="/channels/@me" className={railLink} aria-label="Direct messages">
          <GlacierMark className={s.mark} />
        </NavLink>
      </Tooltip>
      <DmRailBadges />
      <hr className={s.rule} />
      <ul className={s.list}>
        {servers.map((server) => (
          <li key={server.id}>
            <ServerIcon server={server} />
          </li>
        ))}
      </ul>
      <Tooltip label="Add a server" side="right">
        <button type="button" className={s.action} aria-label="Add a server" onClick={() => setCreating(true)}>
          <LuPlus />
        </button>
      </Tooltip>
      <Tooltip label="Discover public servers" side="right">
        <NavLink to="/discover" className={railLink} aria-label="Discover public servers">
          <LuCompass />
        </NavLink>
      </Tooltip>
      <CreateServerModal open={creating} onClose={() => setCreating(false)} />
    </nav>
  )
}
