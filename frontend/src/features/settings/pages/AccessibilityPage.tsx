import { SettingsSection } from '../../../ui/SettingsSection'
import { RadioGroup } from '../../../ui/RadioGroup'
import { Toggle } from '../../../ui/Toggle'
import { settings, useSettings } from '../settingsStore'

export function AccessibilityPage() {
  const s = useSettings()
  return (
    <>
      <SettingsSection title="Motion">
        <RadioGroup
          legend="Animations"
          value={s.motion}
          onChange={(motion) => settings.set({ motion })}
          options={[
            { value: 'system', label: 'Match system', description: 'Reduce motion when your device asks for it.' },
            { value: 'reduce', label: 'Reduce', description: 'No transitions or animations.' },
            { value: 'full', label: 'Always animate', description: 'Animate even if your device is set to reduce motion.' },
          ]}
        />
      </SettingsSection>
      <SettingsSection title="Text">
        <Toggle label="Always underline links" checked={s.underlineLinks} onChange={(underlineLinks) => settings.set({ underlineLinks })} />
      </SettingsSection>
    </>
  )
}
