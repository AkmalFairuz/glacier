import { useLayoutEffect, useRef, useState } from 'react'
import { MessageContent } from '../messages/MessageContent'
import { openFullProfile } from './profileStore'
import s from './ProfileBio.module.css'

/** About me with clickable links; long bios are clamped with a way to read the rest. */
export function ProfileBio({ bio, userId, serverId, clamp }: { bio: string; userId: string; serverId: string | null; clamp?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && clamp) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [bio, clamp])

  return (
    <section className={s.bio} aria-label="About me">
      <div ref={ref} className={clamp ? `${s.text} ${s.clamped}` : s.text}>
        <MessageContent content={bio} edited={false} />
      </div>
      {overflows && (
        <button type="button" className={s.more} onClick={() => openFullProfile(userId, serverId)}>
          View full bio
        </button>
      )}
    </section>
  )
}
