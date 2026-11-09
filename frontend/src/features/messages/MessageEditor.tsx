import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Message } from '../../lib/types'
import { TextArea } from '../../ui/TextArea'
import { messagesApi } from './api'
import { updateMessage } from './cache'
import s from './MessageEditor.module.css'

type Props = { message: Message; onDone: () => void }

export function MessageEditor({ message, onDone }: Props) {
  const qc = useQueryClient()
  const [content, setContent] = useState(message.content)
  const save = useMutation({
    mutationFn: () => messagesApi.edit(message.channel_id, message.id, content.trim()),
    onSuccess: (updated) => {
      updateMessage(qc, updated)
      onDone()
    },
  })

  return (
    <div className={s.editor}>
      <TextArea
        value={content}
        autoFocus
        rows={Math.min(8, content.split('\n').length)}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone()
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (content.trim() && content !== message.content) save.mutate()
            else onDone()
          }
        }}
        aria-label="Edit message"
      />
      <p className={s.hint}>
        Escape to{' '}
        <button type="button" onClick={onDone}>
          cancel
        </button>{' '}
        · Enter to{' '}
        <button type="button" onClick={() => save.mutate()}>
          save
        </button>
      </p>
    </div>
  )
}
