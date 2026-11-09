import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { LuPencil, LuSmilePlus, LuTrash2 } from 'react-icons/lu'
import { formatFull } from '../../lib/format'
import { useTimeFormat } from '../settings/useTimeFormat'
import type { Message } from '../../lib/types'
import { IconButton } from '../../ui/IconButton'
import { useMenu } from '../../ui/useMenu'
import { messagesApi } from './api'
import { deleteMessage } from './cache'
import { AttachmentPreview } from './AttachmentPreview'
import { EmojiPicker } from '../emoji/EmojiPicker'
import { MessageContent } from './MessageContent'
import { search, useSearch } from '../search/searchStore'
import { isFresh } from './freshMessages'
import { MessageEditor } from './MessageEditor'
import { ReactionBar } from './ReactionBar'
import s from './MessageItem.module.css'
import { confirmDialog } from '../../ui/confirm'

export type MessagePerms = { canReact: boolean; canManage: boolean }

type Props = { message: Message; meId: string | undefined; perms: MessagePerms; compact: boolean }

export function MessageItem({ message, meId, perms, compact }: Props) {
  const qc = useQueryClient()
  const picker = useMenu()
  const [editing, setEditing] = useState(false)
  const formatTime = useTimeFormat()
  const [fresh] = useState(() => isFresh(message.id))
  const highlighted = useSearch((st) => st.highlight?.messageId === message.id)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlighted) return
    ref.current?.scrollIntoView({ block: 'center' })
    const timer = window.setTimeout(search.clearHighlight, 2400)
    return () => window.clearTimeout(timer)
  }, [highlighted])
  const isMine = message.author.id === meId
  const remove = useMutation({
    mutationFn: () => messagesApi.remove(message.channel_id, message.id),
    onSuccess: () => deleteMessage(qc, message.channel_id, message.id),
  })
  const toggleReaction = (emoji: string, active: boolean) =>
    void (active ? messagesApi.unreact(message.channel_id, message.id, emoji) : messagesApi.react(message.channel_id, message.id, emoji))

  return (
    <div ref={ref} tabIndex={-1} className={[s.item, fresh && s.fresh, highlighted && s.highlighted].filter(Boolean).join(' ')}>
      {compact && (
        <time className={s.gutterTime} dateTime={message.created_at} title={formatFull(message.created_at)}>
          {formatTime(message.created_at)}
        </time>
      )}
      {editing ? (
        <MessageEditor message={message} onDone={() => setEditing(false)} />
      ) : (
        <MessageContent content={message.content} edited={message.edited_at !== null} />
      )}
      {message.attachments.length > 0 && (
        <div className={s.attachments}>
          {message.attachments.map((a) => (
            <AttachmentPreview key={a.id} attachment={a} />
          ))}
        </div>
      )}
      <ReactionBar reactions={message.reactions} meId={meId} canReact={perms.canReact} onToggle={toggleReaction} />
      <div className={s.actions} role="toolbar" aria-label="Message actions">
        {perms.canReact && <IconButton size="sm" label="Add reaction" icon={<LuSmilePlus />} onClick={picker.openBelow} />}
        {isMine && <IconButton size="sm" label="Edit" icon={<LuPencil />} onClick={() => setEditing(true)} />}
        {(isMine || perms.canManage) && (
          <IconButton
            size="sm"
            danger
            label="Delete"
            icon={<LuTrash2 />}
            onClick={async (e) =>
              (e.shiftKey ||
                (await confirmDialog({
                  title: 'Delete message',
                  message: 'This message will be removed for everyone. Hold Shift to skip this next time.',
                  confirmLabel: 'Delete',
                  danger: true,
                }))) &&
              remove.mutate()
            }
          />
        )}
      </div>
      <EmojiPicker anchor={picker.anchor} onClose={picker.close} onPick={(emoji) => toggleReaction(emoji, false)} />
    </div>
  )
}
