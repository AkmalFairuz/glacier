import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { invitesApi, parseInviteCode } from '../invites/api'
import { upsertServer } from './cache'
import s from './CreateServerModal.module.css'

export function JoinServerStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [invite, setInvite] = useState('')
  const join = useMutation({
    meta: { inlineError: true },
    mutationFn: () => invitesApi.accept(parseInviteCode(invite)),
    onSuccess: (server) => {
      upsertServer(qc, server)
      onDone()
      navigate(`/channels/${server.id}`)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    join.mutate()
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <header className={s.header}>
        <h2 className={s.title}>Join a server</h2>
        <p className={s.lede}>Paste an invite link or code.</p>
      </header>
      <div className={s.scroll}>
        <Field label="Invite link" error={join.error && errorMessage(join.error)}>
          <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={`${location.origin}/invite/k3v9qa7m2p`} required autoFocus />
        </Field>
      </div>
      <footer className={`${s.footer} ${s.row}`}>
        <Button onClick={onBack}>Back</Button>
        <Button type="submit" variant="primary" loading={join.isPending} disabled={!invite.trim()}>
          Join server
        </Button>
      </footer>
    </form>
  )
}
