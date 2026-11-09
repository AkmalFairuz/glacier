import type { CustomStatus } from '../../lib/types'
import s from './CustomStatusText.module.css'

/** One line: the emoji, then the text, truncated. */
export function CustomStatusText({ custom, className }: { custom: CustomStatus; className?: string }) {
  return (
    <span className={className ? `${s.line} ${className}` : s.line} title={custom.text ?? undefined}>
      {custom.emoji && <span className={s.emoji}>{custom.emoji}</span>}
      {custom.text && <span className={s.text}>{custom.text}</span>}
    </span>
  )
}
