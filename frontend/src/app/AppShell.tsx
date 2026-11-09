import { Navigate, Outlet, useLocation } from 'react-router'
import { IncomingCallToast } from '../features/dms/IncomingCallToast'
import { useSession } from '../features/auth/useSession'
import { ServerRail } from '../features/servers/ServerRail'
import { ChannelSettingsHost } from '../features/channels/ChannelSettingsHost'
import { InviteOfferDialog } from '../features/invites/InviteOfferDialog'
import { FullProfileDialog } from '../features/profile/FullProfileDialog'
import { InviteToServerDialog } from '../features/profile/InviteToServerDialog'
import { ProfileCardHost } from '../features/profile/ProfileCardHost'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { useShortcuts } from '../features/settings/useShortcuts'
import { VoiceAudioSink } from '../features/voice/VoiceAudioSink'
import { useGatewayStatus } from '../lib/gateway'
import { layout, useLayout } from './layoutStore'
import { useGatewaySync } from './useGatewaySync'
import s from './AppShell.module.css'

export function AppShell() {
  const token = useSession((st) => st.token)
  const location = useLocation()
  const navOpen = useLayout((st) => st.navOpen)
  const status = useGatewayStatus((st) => st.status)
  useGatewaySync()
  useShortcuts()

  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />

  return (
    <div className={s.shell} data-nav-open={navOpen}>
      {status === 'reconnecting' && (
        <p className={s.banner} role="status">
          Connection lost. Reconnecting…
        </p>
      )}
      <div className={s.columns}>
        <ServerRail />
        <Outlet />
        <button type="button" className={s.scrim} aria-label="Close navigation" onClick={layout.closeNav} tabIndex={-1} />
      </div>
      <VoiceAudioSink />
      <IncomingCallToast />
      <SettingsDialog />
      <ProfileCardHost />
      <FullProfileDialog />
      <InviteToServerDialog />
      <ChannelSettingsHost />
      <InviteOfferDialog />
    </div>
  )
}
