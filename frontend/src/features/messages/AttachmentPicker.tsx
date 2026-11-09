import { useRef } from 'react'
import { LuPaperclip, LuX } from 'react-icons/lu'
import { formatBytes } from '../../lib/format'
import type { Attachment } from '../../lib/types'
import { IconButton } from '../../ui/IconButton'
import { Spinner } from '../../ui/Spinner'
import s from './AttachmentPicker.module.css'

export type PendingUpload = { localId: string; file: File; attachment?: Attachment; error?: string }

export function AttachButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <IconButton label="Attach files" icon={<LuPaperclip />} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </>
  )
}

type ListProps = { uploads: PendingUpload[]; onRemove: (localId: string) => void }

export function PendingUploads({ uploads, onRemove }: ListProps) {
  if (!uploads.length) return null
  return (
    <ul className={s.list} aria-label="Attachments">
      {uploads.map((u) => (
        <li key={u.localId} className={u.error ? `${s.chip} ${s.failed}` : s.chip}>
          {!u.attachment && !u.error && <Spinner label={`Uploading ${u.file.name}`} />}
          <span className={s.name}>{u.file.name}</span>
          <span className={s.size}>{u.error ?? formatBytes(u.file.size)}</span>
          <IconButton size="sm" label={`Remove ${u.file.name}`} icon={<LuX />} onClick={() => onRemove(u.localId)} />
        </li>
      ))}
    </ul>
  )
}
