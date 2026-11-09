import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { LuFolder, LuHash, LuVolume2 } from 'react-icons/lu'
import { errorMessage } from '../../lib/api'
import type { ChannelType } from '../../lib/types'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { channelsApi } from './api'
import { upsertChannel } from './cache'
import s from './CreateChannelModal.module.css'

type Props = { serverId: string; parentId: string | null; open: boolean; onClose: () => void }

const TYPES: { type: ChannelType; label: string; hint: string; icon: ReactNode }[] = [
  { type: 'text', label: 'Text', hint: 'Messages, files and links', icon: <LuHash /> },
  { type: 'voice', label: 'Voice', hint: 'Talk, video and screen share', icon: <LuVolume2 /> },
  { type: 'category', label: 'Category', hint: 'Groups other channels', icon: <LuFolder /> },
]

export function CreateChannelModal({ serverId, parentId, open, onClose }: Props) {
  const qc = useQueryClient()
  const [type, setType] = useState<ChannelType>('text')
  const [name, setName] = useState('')
  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: () =>
      channelsApi.create(serverId, {
        name: type === 'text' ? name.trim().toLowerCase().replace(/\s+/g, '-') : name.trim(),
        type,
        parent_id: type === 'category' ? null : parentId,
      }),
    onSuccess: (channel) => {
      upsertChannel(qc, channel)
      setName('')
      onClose()
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create channel"
      footer={
        <Button type="submit" form="create-channel" variant="primary" loading={create.isPending} disabled={!name.trim()}>
          Create
        </Button>
      }
    >
      <form id="create-channel" className={s.form} onSubmit={onSubmit}>
        <fieldset className={s.types}>
          <legend className={s.legend}>Type</legend>
          {TYPES.filter((t) => !(parentId && t.type === 'category')).map((t) => (
            <label key={t.type} className={s.type}>
              <input type="radio" name="channel-type" checked={type === t.type} onChange={() => setType(t.type)} />
              <span className={s.typeIcon}>{t.icon}</span>
              <span>
                <span className={s.typeLabel}>{t.label}</span>
                <span className={s.typeHint}>{t.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Name" error={create.error && errorMessage(create.error)}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'voice' ? 'Lounge' : 'announcements'}
            maxLength={100}
            required
            autoFocus
          />
        </Field>
      </form>
    </Modal>
  )
}
