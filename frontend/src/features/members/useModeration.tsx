import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LuBan, LuUserMinus } from 'react-icons/lu'
import { can, Perm } from '../../lib/permissions'
import type { User } from '../../lib/types'
import { confirmDialog } from '../../ui/confirm'
import type { MenuEntry } from '../../ui/Menu'
import { toast } from '../../ui/toast'
import { useMe } from '../auth/useSession'
import { usePermissions, useServer } from '../servers/hooks'
import { membersApi } from './api'
import { removeMember } from './cache'

/** Kick / Ban entries for `user` in this server, or [] when the viewer can't moderate them. */
export function useModeration(serverId: string | null | undefined, user: Pick<User, 'id' | 'display_name'> | undefined): MenuEntry[] {
  const qc = useQueryClient()
  const server = useServer(serverId ?? undefined)
  const { data: me } = useMe()
  const perms = usePermissions(serverId ?? undefined).data?.server

  const remove = useMutation({
    mutationFn: (kind: 'kick' | 'ban') => (kind === 'kick' ? membersApi.kick(serverId!, user!.id) : membersApi.ban(serverId!, user!.id, null)),
    onSuccess: (_, kind) => {
      removeMember(qc, serverId!, user!.id)
      toast.success(`${user!.display_name} was ${kind === 'kick' ? 'kicked' : 'banned'}`)
    },
  })

  if (!serverId || !user || !server || user.id === me?.id || user.id === server.owner_id) return []
  const entries: MenuEntry[] = []
  if (can(perms, Perm.KICK_MEMBERS)) {
    entries.push({
      label: 'Kick',
      icon: <LuUserMinus />,
      danger: true,
      onSelect: async () =>
        (await confirmDialog({ title: `Kick ${user.display_name}`, message: 'They can rejoin with an invite.', confirmLabel: 'Kick', danger: true })) &&
        remove.mutate('kick'),
    })
  }
  if (can(perms, Perm.BAN_MEMBERS)) {
    entries.push({
      label: 'Ban',
      icon: <LuBan />,
      danger: true,
      onSelect: async () =>
        (await confirmDialog({
          title: `Ban ${user.display_name}`,
          message: 'They are removed and cannot rejoin until unbanned.',
          confirmLabel: 'Ban',
          danger: true,
        })) && remove.mutate('ban'),
    })
  }
  return entries
}
