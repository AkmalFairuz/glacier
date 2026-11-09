import type { ReactNode } from 'react'
import s from './SettingsSection.module.css'

type Props = { title: string; description?: ReactNode; children: ReactNode; columns?: boolean }

/** A titled block inside a settings page. `columns` lays children out two per row. */
export function SettingsSection({ title, description, children, columns }: Props) {
  return (
    <section className={s.section}>
      <header className={s.header}>
        <h3 className={s.title}>{title}</h3>
        {description && <p className={s.description}>{description}</p>}
      </header>
      <div className={columns ? `${s.body} ${s.columns}` : s.body}>{children}</div>
    </section>
  )
}
