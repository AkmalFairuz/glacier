import { useMyPresence } from '../members/presenceStore'
import { useEffect } from 'react'
import { LuPhone, LuPhoneOff } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { playSound } from '../settings/sounds'
import { joinVoice } from '../voice/useVoiceRoom'
import { dismissRing } from '../voice/voiceSession'
import { useVoice } from '../voice/voiceStore'
import s from './IncomingCallToast.module.css'

export function IncomingCallToast() {
  const ring = useVoice((st) => st.ring)
  const navigate = useNavigate()
  const ringing = !!ring

  useEffect(() => {
    if (!ringing) return
    // Do Not Disturb: show the call, but don't ring.
    if (useMyPresence.getState().status === 'dnd') return
    playSound('call')
    const timer = window.setInterval(() => playSound('call'), 2500)
    return () => window.clearInterval(timer)
  }, [ringing])

  if (!ring) return null

  const accept = () => {
    void joinVoice(ring.channelId, null)
    navigate(`/channels/@me/${ring.channelId}`)
  }

  return (
    <aside className={s.toast} role="alertdialog" aria-label={`Incoming call from ${ring.caller.display_name}`}>
      <Avatar name={ring.caller.display_name} src={ring.caller.avatar_url} seed={ring.caller.id} size="lg" />
      <div className={s.text}>
        <p className={s.name}>{ring.caller.display_name}</p>
        <p className={s.label}>Incoming call</p>
      </div>
      <Button variant="primary" size="sm" icon={<LuPhone />} onClick={accept} autoFocus>
        Join
      </Button>
      <Button variant="ghost" size="sm" icon={<LuPhoneOff />} onClick={dismissRing}>
        Ignore
      </Button>
    </aside>
  )
}
