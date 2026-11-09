import { LuCheck, LuSlash, LuX } from 'react-icons/lu'
import s from './PermissionTriState.module.css'

export type TriValue = 'deny' | 'inherit' | 'allow'

type Props = { label: string; description: string; value: TriValue; onChange: (value: TriValue) => void }

const OPTIONS = [
  { value: 'deny' as const, label: 'Deny', icon: <LuX /> },
  { value: 'inherit' as const, label: 'Inherit', icon: <LuSlash /> },
  { value: 'allow' as const, label: 'Allow', icon: <LuCheck /> },
]

export function PermissionTriState({ label, description, value, onChange }: Props) {
  return (
    <div className={s.row}>
      <div>
        <p className={s.label}>{label}</p>
        <p className={s.description}>{description}</p>
      </div>
      <div role="radiogroup" aria-label={label} className={s.group}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            className={`${s.option} ${s[option.value]}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
