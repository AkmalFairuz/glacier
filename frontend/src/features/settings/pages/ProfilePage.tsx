import type { User } from '../../../lib/types'
import { ProfileForm } from './ProfileForm'

export function ProfilePage({ user }: { user: User }) {
  return (
    <>
      <ProfileForm user={user} />
    </>
  )
}
