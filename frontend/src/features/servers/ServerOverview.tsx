import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../lib/api'
import type { Server } from '../../lib/types'
import { uploadImage } from '../../lib/uploads'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { TextArea } from '../../ui/TextArea'
import { Toggle } from '../../ui/Toggle'
import { ImageUpload } from '../../ui/ImageUpload'
import { serversApi } from './api'
import { upsertServer } from './cache'
import s from './ServerOverview.module.css'

type Props = { server: Server }

export function ServerOverview({ server }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState(server.name)
  const [description, setDescription] = useState(server.description ?? '')
  const [isPublic, setIsPublic] = useState(server.is_public)

  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: (icon?: string) =>
      serversApi.update(server.id, { name: name.trim(), description: description.trim() || null, is_public: isPublic, icon_url: icon }),
    onSuccess: (updated) => upsertServer(qc, updated),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined)
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <ImageUpload label="Server icon" name={server.name} src={server.icon_url} onUpload={async (file) => save.mutate(await uploadImage(file))} />
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </Field>
      <Field label="Description" hint="Shown on the Discover page and invite previews.">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
      </Field>
      <Toggle label="List publicly" description="Anyone can find and join it from Discover." checked={isPublic} onChange={setIsPublic} />
      {save.error && <p className={s.error}>{errorMessage(save.error)}</p>}
      <div className={s.actions}>
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
