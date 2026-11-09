import s from './Strata.module.css'

/*
  Folded ice layers across the bottom of a screen. Angular joints, not curves: glacier strata
  shear and fold rather than wave. Each layer's top edge as y values at nine evenly spaced x stops.
*/
const LAYERS = [
  [36, 22, 44, 30, 50, 26, 40, 18, 34],
  [84, 72, 92, 78, 98, 74, 88, 70, 84],
  [128, 120, 140, 124, 146, 128, 136, 116, 132],
  [170, 164, 180, 166, 184, 172, 176, 162, 174],
  [206, 202, 214, 204, 216, 208, 210, 200, 210],
]

const W = 1440
const H = 240
const step = W / (LAYERS[0].length - 1)
const path = (ys: number[]) => `M0 ${H} ${ys.map((y, i) => `L${i * step} ${y}`).join(' ')} L${W} ${H} Z`

export function Strata({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `${s.strata} ${className}` : s.strata}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {LAYERS.map((ys, i) => (
        <path key={i} d={path(ys)} className={s[`l${i + 1}`]} />
      ))}
    </svg>
  )
}
