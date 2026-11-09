import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { LuCheck, LuCopy } from 'react-icons/lu'
import { errorMessage } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { Select } from '../../ui/Select'
import { invitesApi, inviteUrl } from './api'
import s from './InviteModal.module.css'

const EXPIRY = [
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: 'Never', value: 0 },
]
const USES = [0, 1, 5, 10, 25, 100]

type Props = { serverId: string; open: boolean; onClose: () => void }

export function InviteModal({ serverId, open, onClose }: Props) {
  const [expires, setExpires] = useState(604800)
  const [maxUses, setMaxUses] = useState(0)
  const [copied, setCopied] = useState(false)
  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: () => invitesApi.create(serverId, { expires_in_secs: expires || null, max_uses: maxUses || null }),
  })
  const { mutate } = create

  useEffect(() => {
    if (open) mutate()
  }, [open, expires, maxUses, mutate])

  const url = create.data ? inviteUrl(create.data.code) : ''
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite people" description="Anyone with this link can join the server.">
      <div className={s.body}>
        <div className={s.link}>
          <Input readOnly value={create.isPending ? 'Generating…' : url} aria-label="Invite link" onFocus={(e) => e.target.select()} />
          <Button variant="primary" icon={copied ? <LuCheck /> : <LuCopy />} onClick={copy} disabled={!url}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        {create.error && <p className={s.error}>{errorMessage(create.error)}</p>}
        <div className={s.options}>
          <Field label="Expires after">
            <Select value={String(expires)} options={EXPIRY.map((o) => ({ value: String(o.value), label: o.label }))} onChange={(v) => setExpires(Number(v))} />
          </Field>
          <Field label="Max uses">
            <Select
              value={String(maxUses)}
              options={USES.map((n) => ({ value: String(n), label: n === 0 ? 'No limit' : `${n} use${n === 1 ? '' : 's'}` }))}
              onChange={(v) => setMaxUses(Number(v))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
