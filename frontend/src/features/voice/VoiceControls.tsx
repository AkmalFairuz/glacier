import { LuHeadphoneOff, LuHeadphones, LuMic, LuMicOff, LuPhoneOff, LuSettings, LuVideo, LuVideoOff } from 'react-icons/lu'
import { openSettings } from '../settings/settingsWindow'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { ScreenShareButton } from './ScreenShareButton'
import { voiceActions } from './useVoiceRoom'
import { useVoice } from './voiceStore'
import s from './VoiceControls.module.css'

export function VoiceControls() {
  const muted = useVoice((st) => st.muted)
  const deafened = useVoice((st) => st.deafened)
  const video = useVoice((st) => st.video)
  const notice = useVoice((st) => st.notice)

  return (
    <div className={s.bar}>
      {notice && <p className={s.notice}>{notice}</p>}
      <div className={s.controls} role="toolbar" aria-label="Call controls">
        <IconButton label={muted ? 'Unmute' : 'Mute'} icon={muted ? <LuMicOff /> : <LuMic />} active={muted} onClick={voiceActions.toggleMute} />
        <IconButton
          label={deafened ? 'Undeafen' : 'Deafen'}
          icon={deafened ? <LuHeadphoneOff /> : <LuHeadphones />}
          active={deafened}
          onClick={voiceActions.toggleDeafen}
        />
        <IconButton
          label={video ? 'Turn camera off' : 'Turn camera on'}
          icon={video ? <LuVideo /> : <LuVideoOff />}
          active={video}
          onClick={voiceActions.toggleVideo}
        />
        <ScreenShareButton />
        <IconButton label="Voice and video settings" icon={<LuSettings />} onClick={() => openSettings('voice')} />
        <Button variant="danger" size="sm" icon={<LuPhoneOff />} onClick={voiceActions.leave}>
          Leave
        </Button>
      </div>
    </div>
  )
}
