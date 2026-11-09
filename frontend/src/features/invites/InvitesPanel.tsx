import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LuTrash2 } from 'react-icons/lu'
import { formatFull } from '../../lib/format'
import { keys } from '../../lib/keys'
import type { Invite } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { IconButton } from '../../ui/IconButton'
import { Spinner } from '../../ui/Spinner'
import { invitesApi } from './api'
import s from './InvitesPanel.module.css'

export function InvitesPanel({ serverId }: { serverId: string }) {
  const qc = useQueryClient()
  const { data: invites, isLoading } = useQuery({ queryKey: keys.invites(serverId), queryFn: () => invitesApi.list(serverId) })
  const revoke = useMutation({
    mutationFn: (code: string) => invitesApi.revoke(code),
    onSuccess: (_, code) => qc.setQueryData<Invite[]>(keys.invites(serverId), (list) => list?.filter((i) => i.code !== code)),
  })

  if (isLoading) return <Spinner />
  if (!invites?.length) return <p className={s.none}>No active invites. Create one from the server menu.</p>

  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th scope="col">Created by</th>
          <th scope="col">Code</th>
          <th scope="col">Uses</th>
          <th scope="col">Expires</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {invites.map((invite) => (
          <tr key={invite.code}>
            <td>
              <span className={s.inviter}>
                <Avatar name={invite.inviter?.display_name ?? 'Deleted user'} src={invite.inviter?.avatar_url} seed={invite.inviter_id} size="sm" />
                <span className={s.names}>
                  <span className={s.name}>{invite.inviter?.display_name ?? 'Deleted user'}</span>
                  {invite.inviter && <span className={s.username}>@{invite.inviter.username}</span>}
                </span>
              </span>
            </td>
            <td className={s.numeric}>{invite.code}</td>
            <td className={s.numeric}>
              {invite.uses}
              {invite.max_uses ? ` / ${invite.max_uses}` : ''}
            </td>
            <td>{invite.expires_at ? formatFull(invite.expires_at) : 'Never'}</td>
            <td className={s.action}>
              <IconButton size="sm" label={`Revoke ${invite.code}`} icon={<LuTrash2 />} onClick={() => revoke.mutate(invite.code)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
