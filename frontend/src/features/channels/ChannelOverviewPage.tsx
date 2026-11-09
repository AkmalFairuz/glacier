import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../lib/api'
import type { Channel } from '../../lib/types'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { Slider } from '../../ui/Slider'
import { TextArea } from '../../ui/TextArea'
import { Toggle } from '../../ui/Toggle'
import { toast } from '../../ui/toast'
import { channelsApi } from './api'
import { upsertChannel } from './cache'
import s from './ChannelSettingsPages.module.css'

const TOPIC_MAX = 1024

export function ChannelOverviewPage({ channel }: { channel: Channel }) {
  const qc = useQueryClient()
  const [name, setName] = useState(channel.name ?? '')
  const [topic, setTopic] = useState(channel.topic ?? '')
  const [limit, setLimit] = useState<number | null>(channel.user_limit ?? null)
  const dirty = name.trim() !== (channel.name ?? '') || topic.trim() !== (channel.topic ?? '') || limit !== (channel.user_limit ?? null)
  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: () =>
      channelsApi.update(channel.id, {
        name: name.trim(),
        ...(channel.type === 'text' && { topic: topic.trim() || null }),
        ...(channel.type === 'voice' && { user_limit: limit }),
      }),
    onSuccess: (updated) => {
      upsertChannel(qc, updated)
      setName(updated.name ?? '')
      setTopic(updated.topic ?? '')
      setLimit(updated.user_limit ?? null)
      toast.success('Channel saved')
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <Field label="Channel name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </Field>
      {channel.type === 'text' && (
        <div className={s.topic}>
          <Field label="Channel topic">
            <TextArea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={TOPIC_MAX} rows={6} placeholder="What this channel is for" />
          </Field>
          <span className={s.counter} aria-live="polite">
            {TOPIC_MAX - topic.length}
          </span>
        </div>
      )}
      {channel.type === 'voice' && (
        <div className={s.limit}>
          <Toggle label="Limit users" checked={limit !== null} onChange={(on) => setLimit(on ? 10 : null)} />
          {limit !== null && (
            <Slider label="User limit" min={1} max={100} value={limit} onChange={setLimit} format={(v) => `${v} ${v === 1 ? 'user' : 'users'}`} />
          )}
        </div>
      )}
      {save.error && <p className={s.error}>{errorMessage(save.error)}</p>}
      {dirty && (
        <div className={s.unsaved} role="status">
          <span>You have unsaved changes</span>
          <Button
            variant="ghost"
            onClick={() => {
              setName(channel.name ?? '')
              setTopic(channel.topic ?? '')
              setLimit(channel.user_limit ?? null)
            }}
          >
            Reset
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  )
}
