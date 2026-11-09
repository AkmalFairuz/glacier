import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { keys } from '../../lib/keys'
import { Button } from '../../ui/Button'
import { Spinner } from '../../ui/Spinner'
import { AuthScreen } from '../auth/AuthScreen'
import { useSession } from '../auth/useSession'
import { invitesApi } from './api'
import { InviteInvalid, InviteOffer } from './InviteOffer'
import { openInvite } from './inviteStore'
import s from './InviteAcceptPage.module.css'

/** Signed in: open the offer over the app. Signed out: an auth-style page to register or log in first. */
export function InviteAcceptPage() {
  const { code = '' } = useParams()
  const token = useSession((st) => st.token)
  return token ? <OpenInApp code={code} /> : <SignedOutInvite code={code} />
}

function OpenInApp({ code }: { code: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    openInvite(code)
    navigate('/channels/@me', { replace: true })
  }, [code, navigate])
  return null
}

function SignedOutInvite({ code }: { code: string }) {
  const navigate = useNavigate()
  const invite = useQuery({ queryKey: keys.invite(code), queryFn: () => invitesApi.get(code), retry: false })
  const next = encodeURIComponent(`/invite/${code}`)

  return (
    <AuthScreen>
      {invite.isLoading ? (
        <Spinner />
      ) : invite.data ? (
        <InviteOffer invite={invite.data}>
          <Button variant="primary" onClick={() => navigate(`/register?next=${next}`)}>
            Register to join
          </Button>
          <p className={s.switch}>
            Already have an account?{' '}
            <a
              href={`/login?next=${next}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/login?next=${next}`)
              }}
            >
              Log in
            </a>
          </p>
        </InviteOffer>
      ) : (
        <InviteInvalid>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Go to Glacier
          </Button>
        </InviteInvalid>
      )}
    </AuthScreen>
  )
}
