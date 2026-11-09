import { useQuery } from '@tanstack/react-query'
import { keys } from '../../lib/keys'
import { can, Perm } from '../../lib/permissions'
import { useMe } from '../auth/useSession'
import { useMembers } from '../members/hooks'
import { useIsOnline } from '../members/presenceStore'
import { useRoles } from '../roles/hooks'
import { usePermissions, useServer } from '../servers/hooks'
import { useVoice } from '../voice/voiceStore'
import { profileApi } from './api'

/** Everything a profile view shows, from the profile endpoint plus cached server data. */
export function useProfileData(userId: string, serverId: string | null) {
  const { data: me } = useMe()
  const profile = useQuery({ queryKey: keys.profile(userId), queryFn: () => profileApi.get(userId) })
  const server = useServer(serverId ?? undefined)
  const member = useMembers(serverId ?? undefined).data?.find((m) => m.user.id === userId)
  const roles = useRoles(serverId ?? undefined).data ?? []
  const perms = usePermissions(serverId ?? undefined).data?.server
  const voice = useVoice(
    (s) =>
      Object.values(s.states)
        .flat()
        .find((v) => v.user_id === userId) ?? null,
  )
  const online = useIsOnline(userId, member?.online ?? false)

  const user = profile.data?.user ?? member?.user
  return {
    loading: profile.isLoading && !user,
    user,
    profile: profile.data,
    server,
    member,
    memberRoles: roles.filter((r) => !r.is_default && member?.role_ids.includes(r.id)),
    assignableRoles: roles.filter((r) => !r.is_default && !member?.role_ids.includes(r.id)),
    canManageRoles: !!member && can(perms, Perm.MANAGE_ROLES),
    isMe: userId === me?.id,
    isOwner: server?.owner_id === userId,
    online: userId === me?.id || online,
    voice,
  }
}

export type ProfileData = ReturnType<typeof useProfileData>
