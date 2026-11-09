import { Perm, PERMISSION_INFO } from '../../lib/permissions'
import { Toggle } from '../../ui/Toggle'
import s from './PermissionToggleList.module.css'

type Props = { value: number; onChange: (value: number) => void; disabled?: boolean }

export function PermissionToggleList({ value, onChange, disabled }: Props) {
  return (
    <ul className={s.list}>
      {PERMISSION_INFO.map((info) => {
        const bit = Perm[info.key]
        return (
          <li key={info.key}>
            <Toggle
              label={info.label}
              description={info.description}
              checked={(value & bit) === bit}
              disabled={disabled}
              onChange={(on) => onChange(on ? value | bit : value & ~bit)}
            />
          </li>
        )
      })}
    </ul>
  )
}
