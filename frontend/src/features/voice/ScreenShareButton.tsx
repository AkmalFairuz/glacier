import { LuScreenShare, LuScreenShareOff } from 'react-icons/lu'
import { IconButton } from '../../ui/IconButton'
import { canShareScreen, voiceActions } from './useVoiceRoom'
import { useVoice } from './voiceStore'

export function ScreenShareButton({ size }: { size?: 'sm' | 'md' }) {
  const screen = useVoice((s) => s.screen)
  if (!canShareScreen) return null
  return (
    <IconButton
      size={size}
      label={screen ? 'Stop sharing screen' : 'Share screen'}
      icon={screen ? <LuScreenShareOff /> : <LuScreenShare />}
      active={screen}
      onClick={voiceActions.toggleScreen}
    />
  )
}
