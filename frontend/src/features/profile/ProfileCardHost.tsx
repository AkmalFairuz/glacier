import { useEffect, useLayoutEffect, useRef } from 'react'
import { ProfileCard } from './ProfileCard'
import { closeProfileCard, useProfileView } from './profileStore'
import s from './ProfileCardHost.module.css'

const GAP = 12
const MARGIN = 8

/**
 * Shows the profile card as a top-layer popover beside its anchor; Esc and
 * outside clicks close it. Mount once.
 */
export function ProfileCardHost() {
  const card = useProfileView((st) => st.card)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onToggle = (e: Event) => (e as ToggleEvent).newState === 'closed' && closeProfileCard()
    el.addEventListener('toggle', onToggle)
    return () => el.removeEventListener('toggle', onToggle)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!card) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    if (!el.matches(':popover-open')) el.showPopover()
    const place = () => {
      // Phones: a bottom sheet across the full width.
      if (innerWidth <= 560) {
        el.style.left = '0px'
        el.style.top = `${Math.max(MARGIN, innerHeight - el.offsetHeight)}px`
        return
      }
      const { anchor } = card
      const width = el.offsetWidth
      const height = el.offsetHeight
      // Open toward the side with more room, like a flyout.
      const left = anchor.left > innerWidth / 2 ? anchor.left - width - GAP : anchor.right + GAP
      el.style.left = `${Math.max(MARGIN, Math.min(left, innerWidth - width - MARGIN))}px`
      el.style.top = `${Math.max(MARGIN, Math.min(anchor.top, innerHeight - height - MARGIN))}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(el)
    return () => observer.disconnect()
  }, [card])

  return (
    <div ref={ref} popover="auto" className={s.host}>
      {card && <ProfileCard key={card.userId} userId={card.userId} serverId={card.serverId} />}
    </div>
  )
}
