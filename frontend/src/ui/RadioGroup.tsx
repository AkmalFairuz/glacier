import { useId } from 'react'
import s from './RadioGroup.module.css'

export type RadioOption<T extends string> = { value: T; label: string; description?: string }

type Props<T extends string> = { legend: string; value: T; options: RadioOption<T>[]; onChange: (value: T) => void }

export function RadioGroup<T extends string>({ legend, value, options, onChange }: Props<T>) {
  const name = useId()
  return (
    <fieldset className={s.group}>
      <legend className={s.legend}>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={s.option}>
          <input type="radio" className={s.radio} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className={s.text}>
            <span className={s.label}>{o.label}</span>
            {o.description && <span className={s.description}>{o.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
