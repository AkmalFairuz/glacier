import { LuLogOut } from 'react-icons/lu'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { confirmDialog } from '../../ui/confirm'
import { SettingsShell } from '../../ui/SettingsShell'
import { signOut, useMe } from '../auth/useSession'
import { pageTitle, renderPage, SETTINGS_GROUPS } from './sections'
import { closeSettings, showSettingsPage, useSettingsDialog, type SettingsPageId } from './settingsWindow'
import s from './SettingsDialog.module.css'

/** User settings window. Open it from anywhere with openSettings(page). */
export function SettingsDialog() {
  const { open, page } = useSettingsDialog()
  const { data: me } = useMe()
  if (!me) return null

  const logOut = async () => {
    if (
      await confirmDialog({ title: 'Log out', message: 'You will need your password to sign back in on this device.', confirmLabel: 'Log out', danger: true })
    ) {
      closeSettings()
      void signOut()
    }
  }

  return (
    <SettingsShell
      open={open}
      onClose={closeSettings}
      label="User settings"
      groups={SETTINGS_GROUPS}
      active={page}
      onSelect={(id) => showSettingsPage(id as SettingsPageId)}
      title={pageTitle(page)}
      header={
        <button type="button" className={s.profile} onClick={() => showSettingsPage('profile')}>
          <Avatar name={me.display_name} src={me.avatar_url} seed={me.id} size="lg" />
          <span className={s.names}>
            <span className={s.display}>{me.display_name}</span>
            <span className={s.edit}>Edit profile</span>
          </span>
        </button>
      }
      footer={
        <Button variant="ghost" icon={<LuLogOut />} className={s.logout} onClick={() => void logOut()}>
          Log out
        </Button>
      }
    >
      {renderPage(page, me)}
    </SettingsShell>
  )
}
