import { NavLink } from 'react-router'
import { compareIds } from '../../lib/format'
import { Avatar } from '../../ui/Avatar'
import { Tooltip } from '../../ui/Tooltip'
import { useMe } from '../auth/useSession'
import { useReads } from '../reads/readStore'
import { useDms } from './hooks'
import s from './DmRailBadges.module.css'

/** Unread DMs pinned under the DM button, newest first, each with its count. */
export function DmRailBadges() {
  const { data: me } = useMe()
  const { data: dms = [] } = useDms()
  const counts = useReads((st) => st.counts)
  const heads = useReads((st) => st.heads)
  const unread = dms.filter((dm) => (counts[dm.id] ?? 0) > 0).sort((a, b) => compareIds(heads[b.id]?.lastMessageId ?? b.id, heads[a.id]?.lastMessageId ?? a.id))
  if (!unread.length) return null

  return (
    <ul className={s.list} aria-label="Unread direct messages">
      {unread.map((dm) => {
        const others = dm.recipients.filter((u) => u.id !== me?.id)
        const other = others[0]
        const name = dm.type === 'group_dm' ? (dm.name ?? others.map((u) => u.display_name).join(', ')) : (other?.display_name ?? 'Direct message')
        const count = counts[dm.id] ?? 0
        return (
          <li key={dm.id} className={s.item}>
            <Tooltip label={name} side="right">
              <NavLink to={`/channels/@me/${dm.id}`} className={s.link} aria-label={`${name}, ${count} unread`}>
                <Avatar name={name} src={dm.type === 'dm' ? other?.avatar_url : null} seed={dm.type === 'dm' ? other?.id : dm.id} size="lg" />
                <span className={s.badge} aria-hidden="true">
                  {count >= 100 ? '99+' : count}
                </span>
              </NavLink>
            </Tooltip>
          </li>
        )
      })}
    </ul>
  )
}
