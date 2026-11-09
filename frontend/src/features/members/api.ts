import { client, unwrap } from '../../lib/api'
import type { UpdateMember } from '../../lib/types'

const memberPath = (id: string, uid: string) => ({ params: { path: { id, uid } } })

export const membersApi = {
  list: (serverId: string) => unwrap(client.GET('/api/servers/{id}/members', { params: { path: { id: serverId } } })),
  update: (serverId: string, userId: string, body: UpdateMember) =>
    unwrap(client.PATCH('/api/servers/{id}/members/{uid}', { ...memberPath(serverId, userId), body })),
  kick: (serverId: string, userId: string) => client.DELETE('/api/servers/{id}/members/{uid}', memberPath(serverId, userId)),
  bans: (serverId: string) => unwrap(client.GET('/api/servers/{id}/bans', { params: { path: { id: serverId } } })),
  ban: (serverId: string, userId: string, reason: string | null) =>
    client.PUT('/api/servers/{id}/bans/{uid}', { ...memberPath(serverId, userId), body: { reason } }),
  unban: (serverId: string, userId: string) => client.DELETE('/api/servers/{id}/bans/{uid}', memberPath(serverId, userId)),
}
