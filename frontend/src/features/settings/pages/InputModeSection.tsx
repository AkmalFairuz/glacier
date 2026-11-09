import { KeybindInput } from '../../../ui/KeybindInput'
import { LevelMeter } from '../../../ui/LevelMeter'
import { RadioGroup } from '../../../ui/RadioGroup'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Slider } from '../../../ui/Slider'
import { Toggle } from '../../../ui/Toggle'
import { useMicMeter } from '../hooks/useMicTest'
import { settings, useSettings } from '../settingsStore'
import s from './voice.module.css'

export function InputModeSection() {
  const st = useSettings()
  return (
    <SettingsSection title="Input mode">
      <RadioGroup
        legend="Transmit when"
        value={st.inputMode}
        onChange={(inputMode) => settings.set({ inputMode })}
        options={[
          { value: 'voice', label: 'Voice activity' },
          { value: 'ptt', label: 'Push to talk' },
        ]}
      />
      {st.inputMode === 'voice' ? <Sensitivity /> : <PushToTalk />}
    </SettingsSection>
  )
}

function Sensitivity() {
  const st = useSettings()
  const meter = useMicMeter()
  return (
    <div className={s.stack}>
      <Toggle label="Determine sensitivity automatically" checked={st.autoSensitivity} onChange={(autoSensitivity) => settings.set({ autoSensitivity })} />
      <div className={s.stack}>
        <LevelMeter level={meter.level} threshold={meter.threshold} label="Input level against sensitivity" />
        {!st.autoSensitivity && (
          <Slider
            label="Input sensitivity"
            min={-100}
            max={0}
            value={st.sensitivity}
            onChange={(sensitivity) => settings.set({ sensitivity })}
            format={(v) => `${v} dB`}
          />
        )}
      </div>
    </div>
  )
}

function PushToTalk() {
  const st = useSettings()
  return (
    <div className={s.stack}>
      <div className={s.row}>
        <span className={s.rowLabel}>Shortcut</span>
        <KeybindInput label="Push to talk" singleKey value={st.pttKey} onChange={(pttKey) => settings.set({ pttKey })} />
      </div>
      <Slider
        label="Release delay"
        min={0}
        max={2000}
        step={20}
        value={st.pttReleaseMs}
        onChange={(pttReleaseMs) => settings.set({ pttReleaseMs })}
        format={(v) => `${v} ms`}
      />
      {!st.pttKey && <p className={s.hint}>Set a shortcut, or your microphone will never open.</p>}
    </div>
  )
}
