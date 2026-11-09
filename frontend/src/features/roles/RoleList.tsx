import { useState } from 'react'
import { LuGripVertical, LuPlus } from 'react-icons/lu'
import { colorToHex } from '../../lib/format'
import type { Role } from '../../lib/types'
import { Button } from '../../ui/Button'
import { useDragReorder } from './useDragReorder'
import s from './RoleList.module.css'

type Props = {
  roles: Role[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  creating: boolean
  /** Moves a role to a new index among the non-default roles (0 = top). */
  onMove: (id: string, index: number) => void
}

const roleName = (role: Role) => (role.is_default ? '@everyone' : role.name)

export function RoleList({ roles, selectedId, onSelect, onCreate, creating, onMove }: Props) {
  const ordered = roles.filter((r) => !r.is_default)
  const everyone = roles.find((r) => r.is_default)
  const [announcement, setAnnouncement] = useState('')
  const move = (id: string, index: number) => {
    onMove(id, index)
    const role = ordered.find((r) => r.id === id)
    if (role) setAnnouncement(`${role.name} moved to position ${index + 1} of ${ordered.length}.`)
  }
  const dnd = useDragReorder(
    ordered.map((r) => r.id),
    move,
  )

  const row = (role: Role, index: number | null) => (
    <li
      key={role.id}
      ref={index === null ? undefined : dnd.register(role.id)}
      className={[s.row, role.id === selectedId && s.active, dnd.draggingId === role.id && s.dragging].filter(Boolean).join(' ')}
    >
      {index !== null && dnd.indicator === index && <span className={s.dropLine} aria-hidden="true" />}
      {index !== null ? (
        <button type="button" className={s.handle} aria-label={`Reorder ${role.name}. Use arrow keys to move.`} {...dnd.handleProps(role.id, index)}>
          <LuGripVertical />
        </button>
      ) : (
        <span className={s.handleSpace} />
      )}
      <button type="button" className={s.select} aria-current={role.id === selectedId ? 'true' : undefined} onClick={() => onSelect(role.id)}>
        <span className={s.dot} style={{ backgroundColor: colorToHex(role.color) }} />
        <span className={s.name}>{roleName(role)}</span>
      </button>
    </li>
  )

  return (
    <aside className={s.list} aria-label="Roles">
      <div className={s.head}>
        <Button size="sm" variant="ghost" icon={<LuPlus />} onClick={onCreate} loading={creating}>
          New role
        </Button>
      </div>
      <ul className={s.scroll}>
        {ordered.map((role, i) => row(role, i))}
        {dnd.indicator === ordered.length && <li className={s.dropLineEnd} aria-hidden="true" />}
        {everyone && row(everyone, null)}
      </ul>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </aside>
  )
}
