import type { ReactNode } from 'react'
import type { Invite } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import s from './InviteOffer.module.css'

/** What an invite leads to: who sent it and the server it opens. */
export function InviteOffer({ invite, children }: { invite: Invite; children: ReactNode }) {
  const { server, inviter } = invite
  return (
    <section className={s.offer}>
      <Avatar name={server.name} src={server.icon_url} seed={server.id} size="xxl" />
      <p className={s.from}>{inviter ? `${inviter.display_name} invited you to join` : 'You’ve been invited to join'}</p>
      <h1 className={s.name}>{server.name}</h1>
      <p className={s.meta}>
        <span className={s.dot} aria-hidden="true" />
        {server.member_count} {server.member_count === 1 ? 'member' : 'members'}
      </p>
      {server.description && <p className={s.description}>{server.description}</p>}
      <div className={s.actions}>{children}</div>
    </section>
  )
}

export function InviteInvalid({ children }: { children: ReactNode }) {
  return (
    <section className={s.offer}>
      <h1 className={s.name}>This invite is not valid</h1>
      <p className={s.description}>It may have expired or been revoked. Ask for a new link.</p>
      <div className={s.actions}>{children}</div>
    </section>
  )
}
