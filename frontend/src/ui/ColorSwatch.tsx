import s from './ColorSwatch.module.css'

export const ROLE_COLORS = [0x5b7083, 0x3d6a8a, 0x4f7a5f, 0x8a6d3b, 0xa3402c, 0x7a4f74, 0x2f6f73, 0x6b5b45]

type Props = { value: number | null; onChange: (color: number | null) => void; label?: string }

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

export function ColorSwatch({ value, onChange, label = 'Color' }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className={s.group}>
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="No color"
        className={`${s.swatch} ${s.none}`}
        onClick={() => onChange(null)}
      />
      {ROLE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={hex(color)}
          className={s.swatch}
          style={{ backgroundColor: hex(color) }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
