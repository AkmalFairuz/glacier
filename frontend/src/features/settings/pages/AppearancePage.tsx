import { useMe } from '../../auth/useSession'
import { RadioGroup } from '../../../ui/RadioGroup'
import { Segmented } from '../../../ui/Segmented'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Slider } from '../../../ui/Slider'
import { MessagePreview } from './MessagePreview'
import { settings, useSettings } from '../settingsStore'

export function AppearancePage() {
  const s = useSettings()
  const { data: me } = useMe()
  return (
    <>
      <SettingsSection title="Theme">
        <Segmented
          label="Color theme"
          value={s.theme}
          onChange={(theme) => settings.set({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </SettingsSection>
      <SettingsSection title="Messages">
        <MessagePreview name={me?.display_name ?? 'You'} avatarUrl={me?.avatar_url ?? null} />
        <RadioGroup
          legend="Message display"
          value={s.density}
          onChange={(density) => settings.set({ density })}
          options={[
            { value: 'cozy', label: 'Cozy' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
        <Slider
          label="Chat font size"
          min={12}
          max={20}
          value={s.chatFontSize}
          onChange={(chatFontSize) => settings.set({ chatFontSize })}
          format={(v) => `${v}px`}
        />
        <Segmented
          label="Time format"
          value={s.clock}
          onChange={(clock) => settings.set({ clock })}
          options={[
            { value: 'auto', label: 'Match language' },
            { value: '12h', label: '12-hour' },
            { value: '24h', label: '24-hour' },
          ]}
        />
      </SettingsSection>
    </>
  )
}
