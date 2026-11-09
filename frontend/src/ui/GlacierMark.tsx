import s from './GlacierMark.module.css'

/** Three ice strata, denser toward the bottom like compacted glacier ice. Inherits size and color from its text. */
export function GlacierMark({ className }: { className?: string }) {
  return (
    <svg className={className ? `${s.mark} ${className}` : s.mark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className={s.top} d="M8 4h12l-2 4H6z" />
      <path className={s.middle} d="M5 10h15l-2 4H3z" />
      <path d="M3 16h15l-2 4H1z" />
    </svg>
  )
}
