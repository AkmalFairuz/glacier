import { LuCornerUpRight, LuImage } from 'react-icons/lu'
import type { Message } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { search } from '../search/searchStore'
import s from './ReplyPreview.module.css'

/** The quoted line above a reply; clicking it jumps to the original. */
export function ReplyPreview({ message }: { message: Message }) {
  const original = message.referenced_message
  if (!original) {
    return (
      <p className={`${s.reply} ${s.missing}`}>
        <LuCornerUpRight className={s.glyph} aria-hidden="true" />
        <span>Original message was deleted</span>
      </p>
    )
  }
  const text = original.content.replace(/\s+/g, ' ').trim()
  return (
    <button
      type="button"
      className={s.reply}
      onClick={() => search.jumpTo(message.channel_id, original.id)}
      aria-label={`Replying to ${original.author.display_name}: ${text || 'attachment'}. Jump to message`}
    >
      <Avatar name={original.author.display_name} src={original.author.avatar_url} seed={original.author.id} size="xs" />
      <span className={s.author}>{original.author.display_name}</span>
      {text ? (
        <span className={s.text}>{text}</span>
      ) : (
        <span className={`${s.text} ${s.attachment}`}>
          Click to see attachment <LuImage aria-hidden="true" />
        </span>
      )}
    </button>
  )
}
