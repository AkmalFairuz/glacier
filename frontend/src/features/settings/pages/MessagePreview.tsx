import { Avatar } from '../../../ui/Avatar'
import { useTimeFormat } from '../useTimeFormat'
import s from './MessagePreview.module.css'

const SAMPLE_TIME = new Date(new Date().setHours(21, 42, 0, 0)).toISOString()

/** A static two-line message rendered with the current appearance settings. */
export function MessagePreview({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const time = useTimeFormat()
  return (
    <figure className={s.preview} aria-label="Preview">
      <div className={s.avatar}>
        <Avatar name={name} src={avatarUrl} />
      </div>
      <div>
        <p className={s.header}>
          <span className={s.author}>{name}</span>
          <time className={s.time}>{time(SAMPLE_TIME)}</time>
        </p>
        <p className={s.text}>Notes from Thursday are pinned in #study-notes.</p>
        <p className={s.text}>Bring the problem set; we start at 7.</p>
      </div>
    </figure>
  )
}
