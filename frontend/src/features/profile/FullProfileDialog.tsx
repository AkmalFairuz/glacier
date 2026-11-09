import { useState } from 'react'
import { LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { Avatar } from '../../ui/Avatar'
import { Dialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { IconButton } from '../../ui/IconButton'
import { Tabs } from '../../ui/Tabs'
import { ProfileActions } from './ProfileActions'
import { ProfileBanner } from './ProfileBanner'
import { ProfileFacts } from './ProfileFacts'
import { ProfileIdentity } from './ProfileIdentity'
import { ProfileNote } from './ProfileNote'
import { ProfileRoles } from './ProfileRoles'
import { ProfileBio } from './ProfileBio'
import { ProfileMenu } from './ProfileMenu'
import { closeFullProfile, useProfileView, type FullProfileTab } from './profileStore'
import { useProfileData, type ProfileData } from './useProfileData'
import { VoiceActivity } from './VoiceActivity'
import s from './FullProfileDialog.module.css'

/** Large profile: identity on the left, activity and mutual servers on the right. Mount once. */
export function FullProfileDialog() {
  const full = useProfileView((st) => st.full)
  return (
    <Dialog open={!!full} onClose={closeFullProfile} label="Profile" size="window">
      {full && <FullProfile key={`${full.userId}:${full.tab}`} userId={full.userId} serverId={full.serverId} initialTab={full.tab} />}
    </Dialog>
  )
}

type Tab = FullProfileTab

function FullProfile({ userId, serverId, initialTab }: { userId: string; serverId: string | null; initialTab: Tab }) {
  const data = useProfileData(userId, serverId)
  const [tab, setTab] = useState<Tab>(initialTab)
  if (!data.user) return null
  const mutual = data.profile?.mutual_servers ?? []
  const tabs: { id: Tab; label: string }[] = [
    { id: 'activity', label: 'Activity' },
    ...(data.isMe ? [] : [{ id: 'servers' as const, label: `${mutual.length} mutual ${mutual.length === 1 ? 'server' : 'servers'}` }]),
  ]

  return (
    <div className={s.layout}>
      <aside className={s.side}>
        <ProfileBanner
          user={data.user}
          status={data.status}
          size="full"
          actions={<ProfileMenu user={data.user} serverId={serverId} isMe={data.isMe} inFullView />}
        />
        <div className={s.sideBody}>
          <ProfileIdentity data={data} large />
          <ProfileActions data={data} />
          {data.user.bio && <ProfileBio bio={data.user.bio} userId={userId} serverId={serverId} />}
          <ProfileFacts data={data} />
          <ProfileRoles data={data} />
          {!data.isMe && data.profile && <ProfileNote userId={userId} note={data.profile.note} />}
        </div>
      </aside>
      <section className={s.main} aria-label="Profile details">
        <header className={s.bar}>
          <Tabs label="Profile sections" tabs={tabs} value={tab} onChange={setTab} />
          <IconButton label="Close profile" icon={<LuX />} onClick={closeFullProfile} tooltipSide="bottom" />
        </header>
        <div key={tab} className={s.panel}>
          {tab === 'activity' ? <Activity data={data} /> : <MutualServers data={data} />}
        </div>
      </section>
    </div>
  )
}

function Activity({ data }: { data: ProfileData }) {
  if (!data.voice) return <EmptyState title="Nothing going on" body={`${data.user?.display_name} is not in a voice channel or call.`} />
  return (
    <section className={s.group}>
      <h3 className={s.heading}>Current activity</h3>
      <VoiceActivity state={data.voice} onOpen={closeFullProfile} />
    </section>
  )
}

function MutualServers({ data }: { data: ProfileData }) {
  const navigate = useNavigate()
  const servers = data.profile?.mutual_servers ?? []
  if (!servers.length) return <EmptyState title="No servers in common" body="Invite them to one of yours to start talking." />
  return (
    <ul className={s.servers}>
      {servers.map((server) => (
        <li key={server.id}>
          <button
            type="button"
            className={s.server}
            onClick={() => {
              closeFullProfile()
              navigate(`/channels/${server.id}`)
            }}
          >
            <Avatar name={server.name} src={server.icon_url} seed={server.id} />
            <span className={s.serverName}>{server.name}</span>
            <span className={s.count}>
              {server.member_count} {server.member_count === 1 ? 'member' : 'members'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
