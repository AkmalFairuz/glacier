import { useState } from 'react'
import { RadioGroup } from '../../../ui/RadioGroup'
import { SettingsSection } from '../../../ui/SettingsSection'
import { Toggle } from '../../../ui/Toggle'
import { notificationPermission } from '../notifications'
import { settings, useSettings } from '../settingsStore'

const PERMISSION_HINT = {
  granted: undefined,
  default: undefined,
  denied: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.',
  unsupported: 'This browser does not support desktop notifications.',
}

export function NotificationsPage() {
  const st = useSettings()
  const [permission, setPermission] = useState(notificationPermission)

  const setDesktop = async (on: boolean) => {
    if (on && permission === 'default') {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return
    }
    settings.set({ notifications: on })
  }

  return (
    <>
      <SettingsSection title="Desktop notifications">
        <Toggle
          label="Enable desktop notifications"
          description={PERMISSION_HINT[permission]}
          checked={st.notifications && permission === 'granted'}
          disabled={permission === 'denied' || permission === 'unsupported'}
          onChange={(on) => void setDesktop(on)}
        />
      </SettingsSection>
      <SettingsSection title="Notify me about">
        <RadioGroup
          legend="Messages"
          value={st.notifyLevel}
          onChange={(notifyLevel) => settings.set({ notifyLevel })}
          options={[
            { value: 'dms', label: 'Direct messages only' },
            { value: 'all', label: 'All messages' },
            { value: 'none', label: 'Nothing' },
          ]}
        />
      </SettingsSection>
    </>
  )
}
