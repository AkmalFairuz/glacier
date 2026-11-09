import type { ReactNode } from 'react'
import { LuApple, LuClock, LuFlag, LuGamepad2, LuHand, LuHeart, LuLeaf, LuLightbulb, LuPlane, LuSmile } from 'react-icons/lu'
import s from './EmojiPicker.module.css'

const ICONS: Record<string, { icon: ReactNode; label: string }> = {
  recent: { icon: <LuClock />, label: 'Recently used' },
  smileys: { icon: <LuSmile />, label: 'Smileys & emotion' },
  people: { icon: <LuHand />, label: 'People & body' },
  nature: { icon: <LuLeaf />, label: 'Animals & nature' },
  food: { icon: <LuApple />, label: 'Food & drink' },
  travel: { icon: <LuPlane />, label: 'Travel & places' },
  activities: { icon: <LuGamepad2 />, label: 'Activities' },
  objects: { icon: <LuLightbulb />, label: 'Objects' },
  symbols: { icon: <LuHeart />, label: 'Symbols' },
  flags: { icon: <LuFlag />, label: 'Flags' },
}

/** Category shortcuts down the side of the picker. */
export function CategoryRail({ sections, active, onJump }: { sections: string[]; active: string | null; onJump: (key: string) => void }) {
  return (
    <nav className={s.rail} aria-label="Emoji categories">
      {sections
        .filter((key) => ICONS[key])
        .map((key) => (
          <button
            key={key}
            type="button"
            className={s.railButton}
            aria-label={ICONS[key].label}
            aria-current={key === active || undefined}
            onClick={() => onJump(key)}
          >
            {ICONS[key].icon}
          </button>
        ))}
    </nav>
  )
}
