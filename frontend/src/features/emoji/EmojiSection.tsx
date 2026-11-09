import { memo } from 'react'
import type { Emoji } from './emojiData'
import s from './EmojiPicker.module.css'

type Props = { sectionKey: string; name: string; emojis: Emoji[]; onPick: (e: Emoji) => void; onHover: (e: Emoji) => void }

/** One titled grid of emoji; memoized because the full set is ~1,900 buttons. */
export const EmojiSection = memo(function EmojiSection({ sectionKey, name, emojis, onPick, onHover }: Props) {
  return (
    <section data-section={sectionKey} aria-label={name}>
      <h3 className={s.heading}>{name}</h3>
      <div className={s.grid}>
        {emojis.map((e) => (
          <button
            key={e.unicode}
            type="button"
            className={s.emoji}
            aria-label={e.label}
            onClick={() => onPick(e)}
            onMouseEnter={() => onHover(e)}
            onFocus={() => onHover(e)}
          >
            {e.unicode}
          </button>
        ))}
      </div>
    </section>
  )
})
