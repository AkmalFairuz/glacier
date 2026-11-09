import type { Reaction } from '../../lib/types'
import s from './ReactionBar.module.css'

type Props = { reactions: Reaction[]; meId: string | undefined; canReact: boolean; onToggle: (emoji: string, active: boolean) => void }

export function ReactionBar({ reactions, meId, canReact, onToggle }: Props) {
  if (!reactions.length) return null
  return (
    <ul className={s.bar} aria-label="Reactions">
      {reactions.map((r) => {
        const active = meId !== undefined && r.user_ids.includes(meId)
        return (
          <li key={r.emoji}>
            <button
              type="button"
              className={active ? `${s.chip} ${s.active}` : s.chip}
              aria-pressed={active}
              aria-label={`${r.emoji} ${r.user_ids.length}`}
              disabled={!canReact && !active}
              onClick={() => onToggle(r.emoji, active)}
            >
              <span className={s.emoji}>{r.emoji}</span>
              <span className={s.count}>{r.user_ids.length}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
