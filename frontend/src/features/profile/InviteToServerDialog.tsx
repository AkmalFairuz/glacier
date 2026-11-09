import { useMutation, useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import type { Server } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { EmptyState } from '../../ui/EmptyState'
import { Modal } from '../../ui/Modal'
import { toast } from '../../ui/toast'
import { openDm } from '../dms/api'
import { invitesApi, inviteUrl } from '../invites/api'
import { messagesApi } from '../messages/api'
import { useServers } from '../servers/hooks'
import { profileApi } from './api'
import { closeInviteToServer, useProfileView } from './profileStore'
import s from './InviteToServerDialog.module.css'

/** Lists your servers they are not in; picking one DMs them a fresh invite. Mount once. */
export function InviteToServerDialog() {
  const userId = useProfileView((st) => st.inviting)
  return (
    <Modal open={!!userId} onClose={closeInviteToServer} title="Invite to server" size="sm">
      {userId && <ServerPicker userId={userId} />}
    </Modal>
  )
}

function ServerPicker({ userId }: { userId: string }) {
  const { data: servers = [] } = useServers()
  const { data: profile } = useQuery({ queryKey: keys.profile(userId), queryFn: () => profileApi.get(userId) })
  const shared = new Set(profile?.mutual_servers.map((m) => m.id))
  const candidates = servers.filter((server) => !shared.has(server.id))
  const invite = useMutation({
    mutationFn: async (server: Server) => {
      const created = await invitesApi.create(server.id, {})
      const dm = await openDm([userId])
      await messagesApi.send(dm.id, { content: inviteUrl(created.code) })
      return server
    },
    onSuccess: (server) => {
      toast.success(`Invite to ${server.name} sent to ${profile?.user.display_name ?? 'them'}`)
      closeInviteToServer()
    },
  })

  if (!candidates.length) return <EmptyState title="They’re already in all your servers" />
  return (
    <ul className={s.list}>
      {candidates.map((server) => (
        <li key={server.id} className={s.row}>
          <Avatar name={server.name} src={server.icon_url} seed={server.id} />
          <span className={s.name}>{server.name}</span>
          <button type="button" className={s.invite} disabled={invite.isPending} onClick={() => invite.mutate(server)}>
            Invite
          </button>
        </li>
      ))}
    </ul>
  )
}
