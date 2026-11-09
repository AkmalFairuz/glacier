import { RadioGroup } from '../../../ui/RadioGroup'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Toggle } from '../../../ui/Toggle'
import { settings, useSettings } from '../settingsStore'

export function InputProfileSection() {
  const s = useSettings()
  return (
    <SettingsSection title="Input profile">
      <RadioGroup
        legend="Profile"
        value={s.inputProfile}
        onChange={(inputProfile) => settings.set({ inputProfile })}
        options={[
          { value: 'isolation', label: 'Voice isolation', description: 'Removes echo and background noise.' },
          { value: 'studio', label: 'Studio', description: 'No processing.' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {s.inputProfile === 'custom' && (
        <div>
          <Toggle label="Echo cancellation" checked={s.echoCancellation} onChange={(echoCancellation) => settings.set({ echoCancellation })} />
          <Toggle label="Noise suppression" checked={s.noiseSuppression} onChange={(noiseSuppression) => settings.set({ noiseSuppression })} />
          <Toggle label="Automatic gain control" checked={s.autoGainControl} onChange={(autoGainControl) => settings.set({ autoGainControl })} />
        </div>
      )}
    </SettingsSection>
  )
}
