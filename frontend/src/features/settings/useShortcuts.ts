import { useEffect } from 'react'
import { comboFromEvent, typingInField } from '../../lib/keyboard'
import { voiceActions } from '../voice/useVoiceRoom'
import { setPushToTalk } from '../voice/transmitGate'
import { useVoice } from '../voice/voiceStore'
import { settings, type KeybindAction } from './settingsStore'

const RUN: Record<KeybindAction, () => void> = {
  toggleMute: voiceActions.toggleMute,
  toggleDeafen: voiceActions.toggleDeafen,
  toggleVideo: () => useVoice.getState().session && voiceActions.toggleVideo(),
}

/**
 * Global keybinds and push-to-talk, while the app window has focus.
 * KeybindInput stops propagation while recording, so recording never triggers these.
 */
export function useShortcuts() {
  useEffect(() => {
    const isPtt = (e: KeyboardEvent) => {
      const s = settings.get()
      return s.inputMode === 'ptt' && !!s.pttKey && e.code === s.pttKey
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || typingInField(e)) return
      if (isPtt(e)) return setPushToTalk(true)
      const combo = comboFromEvent(e)
      const action = (Object.entries(settings.get().keybinds) as [KeybindAction, string | null][]).find(([, c]) => c === combo)?.[0]
      if (action) {
        e.preventDefault()
        RUN[action]()
      }
    }
    const onUp = (e: KeyboardEvent) => isPtt(e) && setPushToTalk(false)
    const release = () => setPushToTalk(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
    }
  }, [])
}
