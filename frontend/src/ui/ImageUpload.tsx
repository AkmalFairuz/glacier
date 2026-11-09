import { useRef, useState } from 'react'
import { LuImageUp } from 'react-icons/lu'
import { errorMessage } from '../lib/api'
import { Avatar } from './Avatar'
import { Button } from './Button'
import s from './ImageUpload.module.css'

type Props = { label: string; name: string; src: string | null; onUpload: (file: File) => Promise<void> }

export function ImageUpload({ label, name, src, onUpload }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await onUpload(file)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.upload}>
      <Avatar name={name} src={src} size="xl" />
      <div className={s.side}>
        <p className={s.label}>{label}</p>
        <Button size="sm" variant="primary" icon={<LuImageUp />} loading={busy} onClick={() => input.current?.click()}>
          Upload image
        </Button>
        <p className={error ? s.error : s.hint}>{error ?? 'PNG, JPG, GIF or WebP, up to 8 MB.'}</p>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  )
}
