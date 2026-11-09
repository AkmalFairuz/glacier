import { useEffect, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { comboFromEvent, formatCombo, isModifier } from '../lib/keyboard'
import { IconButton } from './IconButton'
import s from './KeybindInput.module.css'

type Props = {
  label: string
  value: string | null
  onChange: (combo: string | null) => void
  /** Push-to-talk style: a single key, modifiers not combined. */
  singleKey?: boolean
}

/** Click, then press a key combination. Esc cancels. */
export function KeybindInput({ label, value, onChange, singleKey }: Props) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') return setRecording(false)
      if (isModifier(e.code) && !singleKey) return
      onChange(comboFromEvent(e, !singleKey))
      setRecording(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, singleKey, onChange])

  return (
    <div className={s.row}>
      <button
        type="button"
        className={recording ? `${s.capture} ${s.recording}` : s.capture}
        aria-label={`${label}: ${value ? formatCombo(value) : 'not set'}. Activate to record a new shortcut.`}
        onClick={() => setRecording((r) => !r)}
        onBlur={() => setRecording(false)}
      >
        {recording ? 'Press a key…' : value ? formatCombo(value) : 'Not set'}
      </button>
      {value && !recording && <IconButton size="sm" label={`Clear ${label}`} icon={<LuX />} onClick={() => onChange(null)} />}
    </div>
  )
}
