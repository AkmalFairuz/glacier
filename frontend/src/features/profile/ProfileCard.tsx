import { Spinner } from '../../ui/Spinner'
import { MutualServers } from './MutualServers'
import { ProfileActions } from './ProfileActions'
import { ProfileBanner } from './ProfileBanner'
import { ProfileBio } from './ProfileBio'
import { ProfileFacts } from './ProfileFacts'
import { ProfileIdentity } from './ProfileIdentity'
import { ProfileMenu } from './ProfileMenu'
import { ProfileNote } from './ProfileNote'
import { ProfileRoles } from './ProfileRoles'
import { closeProfileCard } from './profileStore'
import { QuickMessage } from './QuickMessage'
import { useProfileData } from './useProfileData'
import { VoiceActivity } from './VoiceActivity'
import s from './ProfileCard.module.css'

/** Compact profile shown next to whatever was clicked. */
export function ProfileCard({ userId, serverId }: { userId: string; serverId: string | null }) {
  const data = useProfileData(userId, serverId)
  if (!data.user) return <div className={s.loading}>{data.loading && <Spinner />}</div>
  const mutual = data.profile?.mutual_servers ?? []

  return (
    <article className={s.card} aria-label={`${data.user.display_name}’s profile`}>
      <ProfileBanner user={data.user} status={data.status} actions={<ProfileMenu user={data.user} serverId={serverId} isMe={data.isMe} />} />
      <div className={s.body}>
        <div className={s.head}>
          <ProfileIdentity data={data} />
          {!data.isMe && <MutualServers userId={userId} serverId={serverId} servers={mutual} />}
        </div>
        {data.voice && <VoiceActivity state={data.voice} onOpen={closeProfileCard} />}
        {data.user.bio && <ProfileBio bio={data.user.bio} userId={userId} serverId={serverId} clamp />}
        <ProfileFacts data={data} />
        <ProfileRoles data={data} />
        {!data.isMe && data.profile && <ProfileNote key={userId} userId={userId} note={data.profile.note} />}
        {data.isMe ? <ProfileActions data={data} /> : <QuickMessage user={data.user} />}
      </div>
    </article>
  )
}
