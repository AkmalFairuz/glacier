import { client, unwrap } from '../../lib/api'

export const profileApi = {
  get: (userId: string) => unwrap(client.GET('/api/users/{id}/profile', { params: { path: { id: userId } } })),
  setNote: (userId: string, note: string) => client.PUT('/api/users/{id}/note', { params: { path: { id: userId } }, body: { note } }),
}
