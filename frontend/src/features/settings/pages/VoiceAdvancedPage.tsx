import { LuRotateCcw } from 'react-icons/lu'
import { Button } from '../../../ui/Button'
import { confirmDialog } from '../../../ui/confirm'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Toggle } from '../../../ui/Toggle'
import { settings, useSettings } from '../settingsStore'
import { ConnectionStats } from './ConnectionStats'

export function VoiceAdvancedPage() {
  const showNonVideo = useSettings((s) => s.showNonVideo)

  const reset = async () => {
    const ok = await confirmDialog({
      title: 'Reset voice and video settings',
      message: 'Devices, volumes, input profile, push to talk, camera and screen share settings go back to their defaults.',
      confirmLabel: 'Reset',
      danger: true,
    })
    if (ok) settings.resetVoice()
  }

  return (
    <>
      <SettingsSection title="Call layout">
        <Toggle label="Show participants without video" checked={showNonVideo} onChange={(v) => settings.set({ showNonVideo: v })} />
      </SettingsSection>
      <SettingsSection title="Connection">
        <ConnectionStats />
      </SettingsSection>
      <SettingsSection title="Reset">
        <div>
          <Button variant="danger" icon={<LuRotateCcw />} onClick={() => void reset()}>
            Reset voice and video settings
          </Button>
        </div>
      </SettingsSection>
    </>
  )
}
