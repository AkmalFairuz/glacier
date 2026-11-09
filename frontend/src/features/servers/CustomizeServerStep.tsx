import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../lib/api'
import { uploadImage } from '../../lib/uploads'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { ImageUpload } from '../../ui/ImageUpload'
import { Input } from '../../ui/Input'
import { Toggle } from '../../ui/Toggle'
import { useMe } from '../auth/useSession'
import { serversApi } from './api'
import { upsertServer } from './cache'
import type { ServerTemplate } from './templates'
import s from './CreateServerModal.module.css'

type Props = { template: ServerTemplate; onBack: () => void; onDone: () => void }

export function CustomizeServerStep({ template, onBack, onDone }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const [name, setName] = useState(me ? `${me.display_name}’s server` : '')
  const [icon, setIcon] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: () => serversApi.create({ name: name.trim(), is_public: isPublic, icon_url: icon, template }),
    onSuccess: (server) => {
      upsertServer(qc, server)
      onDone()
      navigate(`/channels/${server.id}`)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <header className={s.header}>
        <h2 className={s.title}>Customize your server</h2>
        <p className={s.lede}>Give it a name and an icon. You can change both later.</p>
      </header>
      <div className={s.scroll}>
        <div className={s.fields}>
          <ImageUpload label="Server icon" name={name || 'Server'} src={icon} onUpload={async (file) => setIcon(await uploadImage(file))} />
          <Field label="Server name" error={create.error && errorMessage(create.error)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
          </Field>
          <Toggle label="List in Discover" checked={isPublic} onChange={setIsPublic} />
        </div>
      </div>
      <footer className={`${s.footer} ${s.row}`}>
        <Button onClick={onBack}>Back</Button>
        <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()}>
          Create
        </Button>
      </footer>
    </form>
  )
}
