import { LuPencil } from 'react-icons/lu'
import { formatFull } from '../../../lib/format'
import type { User } from '../../../lib/types'
import { Avatar } from '../../../ui/Avatar'
import { Button } from '../../../ui/Button'
import { showSettingsPage } from '../settingsWindow'
import s from './AccountPage.module.css'

export function AccountPage({ user }: { user: User }) {
  return (
    <>
      <div className={s.card}>
        <Avatar name={user.display_name} src={user.avatar_url} seed={user.id} size="xl" />
        <div className={s.names}>
          <p className={s.name}>{user.display_name}</p>
          <p className={s.handle}>@{user.username}</p>
        </div>
        <Button variant="primary" icon={<LuPencil />} onClick={() => showSettingsPage('profile')}>
          Edit profile
        </Button>
      </div>
      <dl className={s.facts}>
        <div>
          <dt>Username</dt>
          <dd>@{user.username}</dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{formatFull(user.created_at)}</dd>
        </div>
      </dl>
    </>
  )
}
