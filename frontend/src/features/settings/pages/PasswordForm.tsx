import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { client, errorMessage } from '../../../lib/api'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { Input } from '../../../ui/Input'
import s from './forms.module.css'

export function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const change = useMutation({
    meta: { inlineError: true },
    mutationFn: async () => {
      const { error } = await client.POST('/api/auth/password', { body: { current_password: current, new_password: next } })
      if (error) throw error
    },
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setRepeat('')
    },
  })
  const mismatch = repeat.length > 0 && next !== repeat

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!mismatch) change.mutate()
  }

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <Field label="Current password">
        <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <div className={s.pair}>
        <Field label="New password" hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match.' : null}>
          <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </Field>
      </div>
      {change.error && (
        <p className={s.error} role="alert">
          {errorMessage(change.error)}
        </p>
      )}
      {change.isSuccess && (
        <p className={s.success} role="status">
          Password changed. Other sessions were signed out.
        </p>
      )}
      <div className={s.actions}>
        <Button type="submit" variant="primary" loading={change.isPending} disabled={!current || next.length < 8 || mismatch}>
          Change password
        </Button>
      </div>
    </form>
  )
}
