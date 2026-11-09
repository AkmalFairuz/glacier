import { useId, type CSSProperties } from 'react'
import s from './Slider.module.css'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
  hideLabel?: boolean
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, disabled, hideLabel }: Props) {
  const id = useId()
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className={s.slider}>
      <div className={hideLabel ? 'visually-hidden' : s.top}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        <output htmlFor={id} className={s.value}>
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={s.range}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
