import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../lib/api'
import { messagesApi } from './api'
import type { PendingUpload } from './AttachmentPicker'
import { addMessage } from './cache'
import { reply, useReply } from './replyStore'
import { cooldowns, useCooldown } from './slowmode'

const TYPING_THROTTLE_MS = 8000

/** `slowmode`: seconds this member must wait between messages here (0 when off or exempt). */
export function useComposer(channelId: string, slowmode = 0) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const lastTyping = useRef(0)

  const patchUpload = (localId: string, patch: Partial<PendingUpload>) =>
    setUploads((list) => list.map((u) => (u.localId === localId ? { ...u, ...patch } : u)))

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const localId = crypto.randomUUID()
      setUploads((list) => [...list, { localId, file }])
      messagesApi
        .upload(channelId, file)
        .then((attachment) => patchUpload(localId, { attachment }))
        .catch((err: unknown) => patchUpload(localId, { error: errorMessage(err) }))
    }
  }

  const removeUpload = (localId: string) => setUploads((list) => list.filter((u) => u.localId !== localId))

  const onTextChange = (value: string) => {
    setText(value)
    const now = Date.now()
    if (value && now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now
      void messagesApi.typing(channelId).catch(() => undefined)
    }
  }

  const send = useMutation({
    mutationFn: () =>
      messagesApi.send(channelId, {
        content: text.trim(),
        attachment_ids: uploads.flatMap((u) => (u.attachment ? [u.attachment.id] : [])),
        reply_to: useReply.getState()[channelId]?.id ?? null,
      }),
    onSuccess: (message) => {
      addMessage(qc, message)
      setText('')
      setUploads([])
      reply.cancel(channelId)
      lastTyping.current = 0
      if (slowmode > 0) cooldowns.start(channelId, slowmode)
    },
    onError: (error) => {
      // Another tab sent first, or the page was reloaded mid-wait: show the server's countdown.
      if (error instanceof ApiError && error.code === 'slowmode') cooldowns.start(channelId, error.retryAfter ?? slowmode)
    },
  })
  const wait = useCooldown(channelId)

  const uploading = uploads.some((u) => !u.attachment && !u.error)
  const ready = uploads.some((u) => u.attachment)
  const canSubmit = !uploading && !send.isPending && wait === 0 && (text.trim().length > 0 || ready)

  return { text, onTextChange, setText, uploads, addFiles, removeUpload, send, canSubmit, wait }
}
