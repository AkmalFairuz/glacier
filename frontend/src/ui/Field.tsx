import type { ReactNode } from 'react'
import s from './Field.module.css'

type Props = { label: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode }

export function Field({ label, hint, error, required, children }: Props) {
  return (
    <label className={s.field}>
      <span className={s.label}>
        {label}
        {required && (
          <span className={s.required} aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className={s.error} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className={s.hint}>{hint}</span>
      )}
    </label>
  )
}
