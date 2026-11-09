import s from './Toggle.module.css'

type Props = { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }

export function Toggle({ label, description, checked, onChange, disabled }: Props) {
  return (
    <label className={s.row}>
      <span className={s.text}>
        <span className={s.label}>{label}</span>
        {description && <span className={s.description}>{description}</span>}
      </span>
      <input type="checkbox" role="switch" className={s.switch} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
