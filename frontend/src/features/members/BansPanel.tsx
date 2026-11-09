import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import { formatFull } from '../../lib/format'
import type { Ban } from '../../lib/types'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Spinner } from '../../ui/Spinner'
import { membersApi } from './api'
import { useBans } from './hooks'
import s from './BansPanel.module.css'

export function BansPanel({ serverId }: { serverId: string }) {
  const qc = useQueryClient()
  const { data: bans, isLoading } = useBans(serverId)
  const unban = useMutation({
    mutationFn: (userId: string) => membersApi.unban(serverId, userId),
    onSuccess: (_, userId) => qc.setQueryData<Ban[]>(keys.bans(serverId), (list) => list?.filter((b) => b.user.id !== userId)),
  })

  if (isLoading) return <Spinner />
  if (!bans?.length) return <p className={s.none}>Nobody is banned from this server.</p>

  return (
    <ul className={s.list}>
      {bans.map((ban) => (
        <li key={ban.user.id} className={s.row}>
          <Avatar name={ban.user.display_name} src={ban.user.avatar_url} seed={ban.user.id} size="sm" />
          <div className={s.info}>
            <p className={s.name}>
              {ban.user.display_name} <span className={s.username}>@{ban.user.username}</span>
            </p>
            <p className={s.meta}>
              {formatFull(ban.created_at)}
              {ban.reason && ` · ${ban.reason}`}
            </p>
          </div>
          <Button size="sm" onClick={() => unban.mutate(ban.user.id)}>
            Revoke ban
          </Button>
        </li>
      ))}
    </ul>
  )
}
