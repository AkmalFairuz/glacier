import { AuthForm } from './AuthForm'
import { AuthScreen } from './AuthScreen'

export function RegisterPage() {
  return (
    <AuthScreen>
      <AuthForm mode="register" />
    </AuthScreen>
  )
}
