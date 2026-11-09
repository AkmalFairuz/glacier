import type { CSSProperties } from 'react'
import s from './LevelMeter.module.css'

const SEGMENTS = 48

type Props = {
  /** 0–1 */
  level: number
  /** 0–1; segments past it are drawn as "would not transmit". */
  threshold?: number
  label: string
}

export function LevelMeter({ level, threshold, label }: Props) {
  const lit = Math.round(level * SEGMENTS)
  const gate = threshold === undefined ? -1 : Math.round(threshold * SEGMENTS)
  return (
    <div className={s.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={i < lit ? (i >= gate ? s.on : s.below) : s.off} />
      ))}
      {threshold !== undefined && <span className={s.gate} style={{ '--at': `${threshold * 100}%` } as CSSProperties} aria-hidden="true" />}
    </div>
  )
}
