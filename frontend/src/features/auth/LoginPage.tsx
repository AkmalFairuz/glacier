import { AuthForm } from './AuthForm'
import { AuthScreen } from './AuthScreen'

export function LoginPage() {
  return (
    <AuthScreen>
      <AuthForm mode="login" />
    </AuthScreen>
  )
}
