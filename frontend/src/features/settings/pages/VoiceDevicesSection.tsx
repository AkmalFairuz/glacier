import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { LevelMeter } from '../../../ui/LevelMeter'
import { Select } from '../../../ui/Select'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Slider } from '../../../ui/Slider'
import { canPickOutput, useMediaDevices } from '../hooks/useMediaDevices'
import { toggleMicTest, useMicMeter } from '../hooks/useMicTest'
import { settings, useSettings } from '../settingsStore'
import s from './voice.module.css'

const pct = (v: number) => `${v}%`

export function VoiceDevicesSection() {
  const st = useSettings()
  const devices = useMediaDevices()
  const test = useMicMeter()

  return (
    <SettingsSection title="Devices" description={!devices.labelled && <DeviceAccess onGrant={() => void devices.requestAccess('audio')} />}>
      <div className={s.columns}>
        <Field label="Microphone">
          <Select value={st.inputDeviceId} options={devices.inputs} onChange={(inputDeviceId) => settings.set({ inputDeviceId })} />
        </Field>
        <Field label="Speaker" hint={canPickOutput ? undefined : 'This browser always uses the system speaker.'}>
          <Select
            value={st.outputDeviceId}
            options={devices.outputs}
            disabled={!canPickOutput}
            onChange={(outputDeviceId) => settings.set({ outputDeviceId })}
          />
        </Field>
        <Slider label="Microphone volume" min={0} max={200} value={st.inputVolume} onChange={(inputVolume) => settings.set({ inputVolume })} format={pct} />
        <Slider label="Speaker volume" min={0} max={100} value={st.outputVolume} onChange={(outputVolume) => settings.set({ outputVolume })} format={pct} />
      </div>
      <div className={s.test}>
        <Button variant={test.testing ? 'ghost' : 'primary'} onClick={toggleMicTest}>
          {test.testing ? 'Stop testing' : 'Mic test'}
        </Button>
        <LevelMeter level={test.level} label="Microphone level" />
      </div>
      {test.error && <p className={s.error}>{test.error}</p>}
    </SettingsSection>
  )
}

function DeviceAccess({ onGrant }: { onGrant: () => void }) {
  return (
    <>
      Device names are hidden until you allow microphone access.{' '}
      <button type="button" className={s.link} onClick={onGrant}>
        Allow access
      </button>
    </>
  )
}
