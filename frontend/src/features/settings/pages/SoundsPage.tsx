import { LuPlay } from 'react-icons/lu'
import { IconButton } from '../../../ui/IconButton'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Slider } from '../../../ui/Slider'
import { Toggle } from '../../../ui/Toggle'
import { settings, useSettings, type SoundId } from '../settingsStore'
import { playSound } from '../sounds'
import s from './SoundsPage.module.css'

const SOUNDS: { id: SoundId; label: string }[] = [
  { id: 'join', label: 'Someone joins' },
  { id: 'leave', label: 'Someone leaves' },
  { id: 'mute', label: 'Mute and deafen' },
  { id: 'message', label: 'New message' },
  { id: 'call', label: 'Incoming call' },
]

export function SoundsPage() {
  const st = useSettings()
  return (
    <>
      <SettingsSection title="Volume">
        <Slider
          label="Sound effects volume"
          min={0}
          max={100}
          value={st.soundVolume}
          onChange={(soundVolume) => settings.set({ soundVolume })}
          format={(v) => `${v}%`}
        />
      </SettingsSection>
      <SettingsSection title="Sound effects">
        <ul className={s.list}>
          {SOUNDS.map((sound) => (
            <li key={sound.id} className={s.item}>
              <IconButton size="sm" label={`Preview ${sound.label.toLowerCase()} sound`} icon={<LuPlay />} onClick={() => playSound(sound.id, true)} />
              <div className={s.toggle}>
                <Toggle label={sound.label} checked={st.sounds[sound.id]} onChange={(on) => settings.setSound(sound.id, on)} />
              </div>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  )
}
