import { LuDownload, LuFile } from 'react-icons/lu'
import { formatBytes } from '../../lib/format'
import type { Attachment } from '../../lib/types'
import s from './AttachmentPreview.module.css'

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const { url, filename, content_type, size, width, height } = attachment

  if (content_type.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={s.imageLink}>
        <img
          src={url}
          alt={filename}
          loading="lazy"
          className={s.image}
          width={width ?? undefined}
          height={height ?? undefined}
          style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
        />
      </a>
    )
  }

  if (content_type.startsWith('video/')) {
    return <video src={url} controls className={s.image} preload="metadata" />
  }

  return (
    <div className={s.file}>
      <LuFile className={s.fileIcon} aria-hidden="true" />
      <div className={s.fileInfo}>
        <a href={url} target="_blank" rel="noreferrer" className={s.fileName}>
          {filename}
        </a>
        <span className={s.size}>{formatBytes(size)}</span>
      </div>
      <a href={url} download={filename} className={s.download} aria-label={`Download ${filename}`}>
        <LuDownload />
      </a>
    </div>
  )
}
