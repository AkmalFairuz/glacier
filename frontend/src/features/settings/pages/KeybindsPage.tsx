import { KeybindInput } from '../../../ui/KeybindInput'
import { SettingsSection } from '../../../ui/SettingsSection'
import { settings, useSettings, type KeybindAction } from '../settingsStore'
import { showSettingsPage } from '../settingsWindow'
import s from './KeybindsPage.module.css'

const ACTIONS: { id: KeybindAction; label: string }[] = [
  { id: 'toggleMute', label: 'Toggle mute' },
  { id: 'toggleDeafen', label: 'Toggle deafen' },
  { id: 'toggleVideo', label: 'Toggle camera' },
]

export function KeybindsPage() {
  const st = useSettings()
  return (
    <>
      <SettingsSection title="Voice">
        <ul className={s.list}>
          {ACTIONS.map((a) => (
            <li key={a.id} className={s.item}>
              <div>
                <p className={s.label}>{a.label}</p>
              </div>
              <KeybindInput label={a.label} value={st.keybinds[a.id]} onChange={(combo) => settings.setKeybind(a.id, combo)} />
            </li>
          ))}
          <li className={s.item}>
            <div>
              <p className={s.label}>Push to talk</p>
              {st.inputMode !== 'ptt' && (
                <button type="button" className={s.link} onClick={() => showSettingsPage('voice')}>
                  Turn on push to talk
                </button>
              )}
            </div>
            <KeybindInput label="Push to talk" singleKey value={st.pttKey} onChange={(pttKey) => settings.set({ pttKey })} />
          </li>
        </ul>
      </SettingsSection>
    </>
  )
}
