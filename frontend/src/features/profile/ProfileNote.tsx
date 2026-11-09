import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keys } from '../../lib/keys'
import { profileApi } from './api'
import s from './ProfileNote.module.css'

/** Private note, saved when the field loses focus. */
export function ProfileNote({ userId, note }: { userId: string; note: string | null }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(note ?? '')

  const save = async () => {
    if (value.trim() === (note ?? '')) return
    await profileApi.setNote(userId, value)
    void qc.invalidateQueries({ queryKey: keys.profile(userId) })
  }

  return (
    <label className={s.note}>
      <span className={s.heading}>Note</span>
      <textarea
        className={s.input}
        value={value}
        maxLength={256}
        rows={1}
        placeholder="Only you can see this"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
      />
    </label>
  )
}
