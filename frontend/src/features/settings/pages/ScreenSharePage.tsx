import { Field } from '../../../ui/Field'
import { Segmented } from '../../../ui/Segmented'
import { Select } from '../../../ui/Select'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Toggle } from '../../../ui/Toggle'
import { settings, useSettings, type ScreenResolution, type Settings } from '../settingsStore'
import s from './voice.module.css'

export function ScreenSharePage() {
  const st = useSettings()
  return (
    <>
      <SettingsSection title="Quality">
        <div className={s.columns}>
          <Field label="Resolution">
            <Select<ScreenResolution>
              value={st.screenResolution}
              onChange={(screenResolution) => settings.set({ screenResolution })}
              options={[
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p' },
                { value: 'source', label: 'Source (no limit)' },
              ]}
            />
          </Field>
          <Field label="Frame rate">
            <Select
              value={String(st.screenFps)}
              onChange={(v) => settings.set({ screenFps: Number(v) as Settings['screenFps'] })}
              options={[
                { value: '5', label: '5 fps' },
                { value: '15', label: '15 fps' },
                { value: '30', label: '30 fps' },
                { value: '60', label: '60 fps' },
              ]}
            />
          </Field>
        </div>
        <Segmented
          label="Optimize for"
          value={st.screenHint}
          onChange={(screenHint) => settings.set({ screenHint })}
          options={[
            { value: 'detail', label: 'Text and detail' },
            { value: 'motion', label: 'Motion and video' },
          ]}
        />
      </SettingsSection>
      <SettingsSection title="Audio">
        <Toggle label="Share audio" checked={st.screenAudio} onChange={(screenAudio) => settings.set({ screenAudio })} />
      </SettingsSection>
    </>
  )
}
