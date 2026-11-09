import { useEffect, useRef } from 'react'
import { LuMicOff, LuMonitor } from 'react-icons/lu'
import { Avatar } from '../../ui/Avatar'
import s from './VideoTile.module.css'

type Props = {
  name: string
  avatarUrl?: string | null
  seed?: string
  stream: MediaStream | null
  muted?: boolean
  isScreen?: boolean
  speaking?: boolean
  mirror?: boolean
  /** Changes whenever tracks change, so the tile can re-check for live video. */
  version: number
}

export function VideoTile({ name, avatarUrl, seed, stream, muted, isScreen, speaking, mirror, version }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)

  useEffect(() => {
    if (video.current && video.current.srcObject !== stream) video.current.srcObject = stream
  }, [stream, hasVideo, version])

  return (
    <figure className={[s.tile, isScreen && s.screen, speaking && s.speaking].filter(Boolean).join(' ')}>
      {hasVideo ? (
        <video ref={video} className={mirror ? `${s.video} ${s.mirror}` : s.video} autoPlay playsInline muted />
      ) : (
        <div className={s.placeholder}>
          <Avatar name={name} src={avatarUrl} seed={seed} size="xl" />
        </div>
      )}
      <figcaption className={s.caption}>
        {isScreen && <LuMonitor aria-hidden="true" />}
        <span>{isScreen ? `${name}’s screen` : name}</span>
        {muted && <LuMicOff className={s.muted} aria-label="Muted" />}
      </figcaption>
    </figure>
  )
}
