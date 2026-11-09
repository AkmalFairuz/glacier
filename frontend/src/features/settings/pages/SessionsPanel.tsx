import { useMutation } from '@tanstack/react-query'
import { LuLogOut } from 'react-icons/lu'
import { client, errorMessage, unwrap } from '../../../lib/api'
import { Button } from '../../../ui/Button'
import { confirmDialog } from '../../../ui/confirm'
import s from './forms.module.css'

export function SessionsPanel() {
  const revoke = useMutation({
    meta: { inlineError: true },
    mutationFn: () => unwrap(client.POST('/api/auth/sessions/revoke-others')),
  })

  const onClick = async () => {
    const ok = await confirmDialog({
      title: 'Sign out other sessions',
      message: 'Every other browser and device signed in to your account will be signed out. This one stays signed in.',
      confirmLabel: 'Sign out others',
      danger: true,
    })
    if (ok) revoke.mutate()
  }

  return (
    <div className={s.form}>
      <div className={s.actions}>
        <Button icon={<LuLogOut />} loading={revoke.isPending} onClick={() => void onClick()}>
          Sign out all other sessions
        </Button>
      </div>
      {revoke.data && (
        <p className={s.success} role="status">
          {revoke.data.revoked === 0
            ? 'No other sessions were active.'
            : `Signed out ${revoke.data.revoked} other ${revoke.data.revoked === 1 ? 'session' : 'sessions'}.`}
        </p>
      )}
      {revoke.error && (
        <p className={s.error} role="alert">
          {errorMessage(revoke.error)}
        </p>
      )}
    </div>
  )
}
