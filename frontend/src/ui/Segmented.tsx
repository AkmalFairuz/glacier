import { useId } from 'react'
import s from './Segmented.module.css'

type Props<T extends string> = { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }

/** Compact single choice for two to four short options. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId()
  return (
    <fieldset className={s.root}>
      <legend className={s.legend}>{label}</legend>
      <div className={s.track}>
        {options.map((o) => (
          <label key={o.value} className={s.item}>
            <input type="radio" className={s.input} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className={s.text}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
