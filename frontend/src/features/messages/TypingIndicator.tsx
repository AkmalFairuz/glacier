import { Fragment } from 'react'
import { useMe } from '../auth/useSession'
import { useTyping } from './typingStore'
import s from './TypingIndicator.module.css'

const EMPTY: never[] = []

/** "●●● Kira is typing…", names in bold; collapses to "Several people" past three. */
export function TypingIndicator({ channelId }: { channelId: string }) {
  const { data: me } = useMe()
  const names = useTyping((st) => st[channelId] ?? EMPTY)
    .filter((t) => t.userId !== me?.id)
    .map((t) => t.name)

  const who =
    names.length > 3 ? (
      <strong>Several people</strong>
    ) : (
      names.map((name, i) => (
        <Fragment key={name}>
          {i > 0 && (i === names.length - 1 ? ' and ' : ', ')}
          <strong>{name}</strong>
        </Fragment>
      ))
    )

  return (
    <p className={s.typing} aria-live="polite">
      {names.length > 0 && (
        <span className={s.line}>
          <span className={s.dots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {who} {names.length === 1 ? 'is' : 'are'} typing…
        </span>
      )}
    </p>
  )
}
