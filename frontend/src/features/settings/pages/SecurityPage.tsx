import { SettingsSection } from '../../../ui/SettingsSection'
import { PasswordForm } from './PasswordForm'
import { SessionsPanel } from './SessionsPanel'

export function SecurityPage() {
  return (
    <>
      <SettingsSection title="Password" description="Changing your password signs you out everywhere else.">
        <PasswordForm />
      </SettingsSection>
      <SettingsSection title="Sessions">
        <SessionsPanel />
      </SettingsSection>
    </>
  )
}
