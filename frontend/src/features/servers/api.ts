import { client, unwrap } from '../../lib/api'
import type { CreateServer, UpdateServer } from '../../lib/types'

const path = (id: string) => ({ params: { path: { id } } })

export const serversApi = {
  list: () => unwrap(client.GET('/api/servers')),
  discover: (q: string) => unwrap(client.GET('/api/servers/discover', { params: { query: { q: q || null } } })),
  create: (body: CreateServer) => unwrap(client.POST('/api/servers', { body })),
  update: (id: string, body: UpdateServer) => unwrap(client.PATCH('/api/servers/{id}', { ...path(id), body })),
  remove: (id: string) => client.DELETE('/api/servers/{id}', path(id)),
  join: (id: string) => unwrap(client.POST('/api/servers/{id}/join', path(id))),
  leave: (id: string) => client.DELETE('/api/servers/{id}/members/{uid}', { params: { path: { id, uid: '@me' } } }),
  permissions: (id: string) => unwrap(client.GET('/api/servers/{id}/permissions', path(id))),
}
