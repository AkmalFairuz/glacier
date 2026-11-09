import { useEffect, useRef } from 'react'
import { LuSendHorizontal, LuSmile } from 'react-icons/lu'
import { errorMessage } from '../../lib/api'
import { IconButton } from '../../ui/IconButton'
import { TextArea } from '../../ui/TextArea'
import { useMenu } from '../../ui/useMenu'
import { AttachButton, PendingUploads } from './AttachmentPicker'
import { EmojiPicker } from '../emoji/EmojiPicker'
import { useComposer } from './useComposer'
import s from './Composer.module.css'

type Props = { channelId: string; placeholder: string; canSend: boolean; canAttach: boolean }

export function Composer({ channelId, placeholder, canSend, canAttach }: Props) {
  const composer = useComposer(channelId)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const emoji = useMenu()

  useEffect(() => {
    if (!composer.text && textarea.current) textarea.current.style.height = ''
  }, [composer.text])

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault()
    if (composer.canSubmit) composer.send.mutate()
  }

  const insertEmoji = (value: string) => {
    const el = textarea.current
    const at = el?.selectionStart ?? composer.text.length
    composer.setText(composer.text.slice(0, at) + value + composer.text.slice(at))
    el?.focus()
  }

  if (!canSend) {
    return <p className={s.readonly}>You do not have permission to send messages here.</p>
  }

  return (
    <form className={s.composer} onSubmit={submit}>
      <div className={s.box}>
        <PendingUploads uploads={composer.uploads} onRemove={composer.removeUpload} />
        <div className={s.row}>
          {canAttach && <AttachButton onFiles={composer.addFiles} />}
          <TextArea
            ref={textarea}
            bare
            rows={1}
            className={s.input}
            value={composer.text}
            placeholder={placeholder}
            aria-label={placeholder}
            maxLength={4000}
            onChange={(e) => composer.onTextChange(e.target.value)}
            onInput={(e) => {
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
            }}
            onPaste={(e) => canAttach && e.clipboardData.files.length > 0 && composer.addFiles([...e.clipboardData.files])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
            }}
          />
          <IconButton label="Insert emoji" icon={<LuSmile />} onClick={emoji.openBelow} />
          <IconButton type="submit" label="Send" icon={<LuSendHorizontal />} disabled={!composer.canSubmit} />
        </div>
      </div>
      {composer.send.error && <p className={s.error}>{errorMessage(composer.send.error)}</p>}
      <EmojiPicker anchor={emoji.anchor} onClose={emoji.close} onPick={insertEmoji} />
    </form>
  )
}
