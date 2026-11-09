import type { ReactNode } from 'react'
import { MobileNavButton } from '../../app/MobileNavButton'
import s from './ChannelHeader.module.css'

type Props = { icon: ReactNode; title: string; topic?: string | null; actions?: ReactNode; search?: ReactNode }

export function ChannelHeader({ icon, title, topic, actions, search }: Props) {
  return (
    <header className={s.header}>
      <MobileNavButton />
      <span className={s.icon} aria-hidden="true">
        {icon}
      </span>
      <h1 className={s.title}>{title}</h1>
      {topic && <p className={s.topic}>{topic}</p>}
      <div className={s.actions}>
        {actions}
        {search}
      </div>
    </header>
  )
}
