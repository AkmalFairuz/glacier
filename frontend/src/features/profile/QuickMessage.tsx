import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { queryClient } from '../../lib/queryClient'
import type { User } from '../../lib/types'
import { toast } from '../../ui/toast'
import { openDm } from '../dms/api'
import { upsertDm } from '../dms/cache'
import { messagesApi } from '../messages/api'
import s from './QuickMessage.module.css'

/** "Message @name": sends a DM without leaving where you are. */
export function QuickMessage({ user }: { user: User }) {
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: async (content: string) => {
      const dm = await openDm([user.id])
      upsertDm(queryClient, dm)
      return messagesApi.send(dm.id, { content })
    },
    onSuccess: () => {
      setText('')
      toast.success(`Message sent to ${user.display_name}`)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) send.mutate(text.trim())
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <input
        className={s.input}
        value={text}
        maxLength={4000}
        disabled={send.isPending}
        placeholder={`Message @${user.display_name}`}
        aria-label={`Message ${user.display_name}`}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  )
}
