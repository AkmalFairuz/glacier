import { useState } from 'react'
import { LuSmilePlus } from 'react-icons/lu'
import type { CustomStatus } from '../../lib/types'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { IconButton } from '../../ui/IconButton'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { Select } from '../../ui/Select'
import { useMenu } from '../../ui/useMenu'
import { EmojiPicker } from '../emoji/EmojiPicker'
import { useUpdatePresence } from './presenceApi'
import s from './CustomStatusDialog.module.css'

type Expiry = 'keep' | 'never' | '30m' | '1h' | '4h' | 'today'

const MINUTES: Partial<Record<Expiry, number>> = { '30m': 30, '1h': 60, '4h': 240 }

function expiresAt(choice: Expiry, current: string | null): string | null {
  if (choice === 'keep') return current
  if (choice === 'never') return null
  if (choice === 'today') {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return end.toISOString()
  }
  return new Date(Date.now() + (MINUTES[choice] ?? 0) * 60_000).toISOString()
}

type Props = { open: boolean; onClose: () => void; current: CustomStatus | null }

export function CustomStatusDialog({ open, onClose, current }: Props) {
  const [emoji, setEmoji] = useState(current?.emoji ?? '')
  const [text, setText] = useState(current?.text ?? '')
  const [expiry, setExpiry] = useState<Expiry>(current?.expires_at ? 'keep' : 'never')
  const picker = useMenu()
  const update = useUpdatePresence()

  const keepLabel = current?.expires_at
    ? `Keep (${new Date(current.expires_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })})`
    : null
  const options = [
    ...(keepLabel ? [{ value: 'keep' as const, label: keepLabel }] : []),
    { value: 'never' as const, label: 'Don’t clear' },
    { value: '30m' as const, label: '30 minutes' },
    { value: '1h' as const, label: '1 hour' },
    { value: '4h' as const, label: '4 hours' },
    { value: 'today' as const, label: 'Today' },
  ]

  const save = () => {
    const empty = !text.trim() && !emoji
    update.mutate(
      { custom_status: empty ? null : { text: text.trim() || null, emoji: emoji || null, expires_at: expiresAt(expiry, current?.expires_at ?? null) } },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set a custom status"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={update.isPending} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <Field label="Status">
          <div className={s.row}>
            <IconButton
              label={emoji ? `Change emoji (${emoji})` : 'Pick an emoji'}
              icon={emoji ? <span className={s.emoji}>{emoji}</span> : <LuSmilePlus />}
              onClick={picker.openBelow}
            />
            <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={128} placeholder="What are you up to?" autoFocus />
          </div>
        </Field>
        <Field label="Clear after">
          <Select value={expiry} onChange={setExpiry} options={options} />
        </Field>
      </div>
      <EmojiPicker anchor={picker.anchor} onClose={picker.close} onPick={(value) => setEmoji(value)} />
    </Modal>
  )
}
