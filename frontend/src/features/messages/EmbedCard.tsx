import { LuX } from 'react-icons/lu'
import type { Embed } from '../../lib/types'
import { IconButton } from '../../ui/IconButton'
import s from './EmbedCard.module.css'

/** Images at least this wide show full width under the text; smaller ones become a thumbnail. */
const LARGE_IMAGE = 360

type Props = { embed: Embed; onRemove?: () => void }

/** Open Graph card for a link. The image is Glacier's copy under /files, never the original host. */
export function EmbedCard({ embed, onRemove }: Props) {
  const image = embed.image
  const large = !!image && (image.width ?? 0) >= LARGE_IMAGE
  return (
    <article className={s.card} aria-label={`Link preview: ${embed.title ?? embed.site_name ?? embed.url}`}>
      <div className={s.body}>
        <div className={s.text}>
          {embed.site_name && <p className={s.site}>{embed.site_name}</p>}
          {embed.title && (
            <a className={s.title} href={embed.url} target="_blank" rel="noreferrer noopener">
              {embed.title}
            </a>
          )}
          {embed.description && <p className={s.description}>{embed.description}</p>}
        </div>
        {image && !large && <img className={s.thumb} src={image.url} alt="" loading="lazy" />}
      </div>
      {image && large && (
        <a href={embed.url} target="_blank" rel="noreferrer noopener" className={s.imageLink} tabIndex={-1}>
          <img className={s.image} src={image.url} alt="" loading="lazy" width={image.width ?? undefined} height={image.height ?? undefined} />
        </a>
      )}
      {onRemove && (
        <span className={s.remove}>
          <IconButton size="sm" label="Remove link previews" icon={<LuX />} onClick={onRemove} />
        </span>
      )}
    </article>
  )
}
