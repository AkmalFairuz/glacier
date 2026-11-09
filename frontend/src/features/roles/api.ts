import { client, unwrap } from '../../lib/api'
import type { CreateRole, UpdateRole } from '../../lib/types'

const rolePath = (id: string, rid: string) => ({ params: { path: { id, rid } } })

export const rolesApi = {
  list: (serverId: string) => unwrap(client.GET('/api/servers/{id}/roles', { params: { path: { id: serverId } } })),
  create: (serverId: string, body: CreateRole) => unwrap(client.POST('/api/servers/{id}/roles', { params: { path: { id: serverId } }, body })),
  update: (serverId: string, roleId: string, body: UpdateRole) =>
    unwrap(client.PATCH('/api/servers/{id}/roles/{rid}', { ...rolePath(serverId, roleId), body })),
  remove: (serverId: string, roleId: string) => client.DELETE('/api/servers/{id}/roles/{rid}', rolePath(serverId, roleId)),
}
