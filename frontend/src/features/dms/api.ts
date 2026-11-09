import { client, unwrap } from '../../lib/api'

export const dmsApi = {
  list: () => unwrap(client.GET('/api/dms')),
  rename: (id: string, name: string) => unwrap(client.PATCH('/api/dms/{id}', { params: { path: { id } }, body: { name } })),
  addRecipient: (id: string, uid: string) => unwrap(client.PUT('/api/dms/{id}/recipients/{uid}', { params: { path: { id, uid } } })),
  leave: (id: string) => client.DELETE('/api/dms/{id}/recipients/@me', { params: { path: { id } } }),
  searchUsers: (q: string) => unwrap(client.GET('/api/users/search', { params: { query: { q } } })),
}

export function openDm(userIds: string[], name?: string) {
  return unwrap(client.POST('/api/dms', { body: { user_ids: userIds, name: name ?? null } }))
}
