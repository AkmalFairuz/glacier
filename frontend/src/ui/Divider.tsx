import s from './Divider.module.css'

export function Divider({ label, tone }: { label?: string; tone?: 'danger' }) {
  if (!label) return <hr className={s.rule} />
  return (
    <div role="separator" aria-label={label} className={tone ? `${s.labelled} ${s[tone]}` : s.labelled}>
      <span>{label}</span>
    </div>
  )
}
