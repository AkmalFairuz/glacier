import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Input } from '../../ui/Input'
import { authApi } from './api'
import { signIn, useSession } from './useSession'
import s from './AuthForm.module.css'

type Props = { mode: 'login' | 'register' }

export function AuthForm({ mode }: Props) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/channels/@me'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const mutation = useMutation({
    meta: { inlineError: true },
    mutationFn: () => (mode === 'login' ? authApi.login({ username, password }) : authApi.register({ username, password, display_name: displayName || null })),
    onSuccess: (res) => {
      signIn(res)
      navigate(next, { replace: true })
    },
  })

  const token = useSession((st) => st.token)
  if (token && !mutation.isSuccess) return <Navigate to={next} replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  const isLogin = mode === 'login'
  const switchTo = `${isLogin ? '/register' : '/login'}${params.size ? `?${params}` : ''}`

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <header className={s.header}>
        <h1 className={s.title}>{isLogin ? 'Log in to Glacier' : 'Create your account'}</h1>
      </header>
      <Field label="Username" required hint={isLogin ? undefined : 'Lowercase letters, numbers, dots and underscores.'}>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          required
          minLength={2}
          maxLength={32}
          autoFocus
        />
      </Field>
      {!isLogin && (
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
        </Field>
      )}
      <Field label="Password" required hint={isLogin ? undefined : 'At least 8 characters.'}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={isLogin ? 1 : 8}
        />
      </Field>
      {mutation.error && (
        <p className={s.error} role="alert">
          {errorMessage(mutation.error)}
        </p>
      )}
      <Button type="submit" variant="primary" className={s.submit} loading={mutation.isPending}>
        {isLogin ? 'Log in' : 'Create account'}
      </Button>
      <p className={s.switch}>
        {isLogin ? 'Need an account? ' : 'Already have an account? '}
        <Link to={switchTo}>{isLogin ? 'Register' : 'Log in'}</Link>
      </p>
    </form>
  )
}
