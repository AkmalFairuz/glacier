import type { ReactNode } from 'react'
import s from './EmptyState.module.css'

type Props = { title: string; body?: string; action?: ReactNode }

export function EmptyState({ title, body, action }: Props) {
  return (
    <section className={s.empty}>
      <h2 className={s.title}>{title}</h2>
      {body && <p className={s.body}>{body}</p>}
      {action && <div className={s.action}>{action}</div>}
    </section>
  )
}
