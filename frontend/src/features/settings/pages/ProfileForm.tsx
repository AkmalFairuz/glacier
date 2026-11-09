import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { client, errorMessage, unwrap } from '../../../lib/api'
import { keys } from '../../../lib/keys'
import type { UpdateUser, User } from '../../../lib/types'
import { uploadImage } from '../../../lib/uploads'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { ImageUpload } from '../../../ui/ImageUpload'
import { ColorSwatch } from '../../../ui/ColorSwatch'
import { Input } from '../../../ui/Input'
import { TextArea } from '../../../ui/TextArea'
import s from './forms.module.css'

export function ProfileForm({ user }: { user: User }) {
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState(user.display_name)
  const [bio, setBio] = useState(user.bio ?? '')
  const [banner, setBanner] = useState(user.banner_color)
  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: UpdateUser) => unwrap(client.PATCH('/api/users/@me', { body })),
    onSuccess: (updated) => qc.setQueryData(keys.me, updated),
  })
  const dirty = displayName.trim() !== user.display_name || bio.trim() !== (user.bio ?? '') || banner !== user.banner_color

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate({ display_name: displayName.trim(), bio: bio.trim() || null, banner_color: banner })
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <ImageUpload
        label="Avatar"
        name={user.display_name}
        src={user.avatar_url}
        onUpload={async (file) => void update.mutate({ avatar_url: await uploadImage(file) })}
      />
      {user.avatar_url && (
        <Button size="sm" variant="ghost" className={s.inline} onClick={() => update.mutate({ avatar_url: null })}>
          Remove avatar
        </Button>
      )}
      <Field label="Display name" error={update.error && errorMessage(update.error)}>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} required />
      </Field>
      <Field label="About me" hint={`${190 - bio.length} characters left`}>
        <TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={190} rows={3} />
      </Field>
      <Field label="Banner color">
        <ColorSwatch label="Banner color" value={banner} onChange={setBanner} />
      </Field>
      <div className={s.actions}>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setDisplayName(user.display_name)
              setBio(user.bio ?? '')
              setBanner(user.banner_color)
            }}
          >
            Reset
          </Button>
        )}
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty || !displayName.trim()}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
