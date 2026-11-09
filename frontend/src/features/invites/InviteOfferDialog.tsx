import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../lib/api'
import { keys } from '../../lib/keys'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Spinner } from '../../ui/Spinner'
import { upsertServer } from '../servers/cache'
import { useServers } from '../servers/hooks'
import { invitesApi } from './api'
import { InviteInvalid, InviteOffer } from './InviteOffer'
import { closeInvite, useInviteOffer } from './inviteStore'
import s from './InviteOfferDialog.module.css'

/** In-app invite offer. Mount once; open with openInvite(code). */
export function InviteOfferDialog() {
  const code = useInviteOffer((st) => st.code)
  return (
    <Dialog open={!!code} onClose={closeInvite} label="Server invite" size="sm">
      <div className={s.body}>{code && <OfferBody key={code} code={code} />}</div>
    </Dialog>
  )
}

function OfferBody({ code }: { code: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: servers = [] } = useServers()
  const invite = useQuery({ queryKey: keys.invite(code), queryFn: () => invitesApi.get(code), retry: false })
  const accept = useMutation({
    meta: { inlineError: true },
    mutationFn: () => invitesApi.accept(code),
    onSuccess: (server) => {
      upsertServer(qc, server)
      closeInvite()
      navigate(`/channels/${server.id}`)
    },
  })

  if (invite.isLoading) return <Spinner />
  if (!invite.data) {
    return (
      <InviteInvalid>
        <Button onClick={closeInvite}>Close</Button>
      </InviteInvalid>
    )
  }
  const already = servers.some((x) => x.id === invite.data.server.id)
  return (
    <InviteOffer invite={invite.data}>
      {accept.error && <p className={s.error}>{errorMessage(accept.error)}</p>}
      {already ? (
        <>
          <p className={s.note}>You’re already a member.</p>
          <Button
            variant="primary"
            onClick={() => {
              closeInvite()
              navigate(`/channels/${invite.data.server.id}`)
            }}
          >
            Go to server
          </Button>
        </>
      ) : (
        <Button variant="primary" loading={accept.isPending} onClick={() => accept.mutate()}>
          Accept invite
        </Button>
      )}
      <Button onClick={closeInvite}>Not now</Button>
    </InviteOffer>
  )
}
