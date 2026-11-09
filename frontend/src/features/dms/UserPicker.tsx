import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { keys } from '../../lib/keys'
import type { User } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Input } from '../../ui/Input'
import { dmsApi } from './api'
import s from './UserPicker.module.css'

type Props = { selected: User[]; onChange: (users: User[]) => void; max: number; exclude?: string[] }

export function UserPicker({ selected, onChange, max, exclude = [] }: Props) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())
  const { data: results = [] } = useQuery({ queryKey: keys.userSearch(q), queryFn: () => dmsApi.searchUsers(q), enabled: q.length > 0 })
  const visible = results.filter((u) => !exclude.includes(u.id))
  const isSelected = (u: User) => selected.some((x) => x.id === u.id)
  const toggle = (u: User) => onChange(isSelected(u) ? selected.filter((x) => x.id !== u.id) : [...selected, u])

  return (
    <div className={s.picker}>
      {selected.length > 0 && (
        <ul className={s.chips} aria-label="Selected people">
          {selected.map((u) => (
            <li key={u.id}>
              <button type="button" className={s.chip} onClick={() => toggle(u)} aria-label={`Remove ${u.display_name}`}>
                {u.display_name}
                <LuX aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username" aria-label="Search people" autoFocus />
      <ul className={s.results}>
        {visible.map((u) => (
          <li key={u.id}>
            <label className={s.result}>
              <Avatar name={u.display_name} src={u.avatar_url} seed={u.id} size="sm" />
              <span className={s.name}>
                {u.display_name}
                <span className={s.username}>@{u.username}</span>
              </span>
              <input type="checkbox" checked={isSelected(u)} disabled={!isSelected(u) && selected.length >= max} onChange={() => toggle(u)} />
            </label>
          </li>
        ))}
        {q && visible.length === 0 && <li className={s.none}>No one matches “{q}”.</li>}
      </ul>
    </div>
  )
}
