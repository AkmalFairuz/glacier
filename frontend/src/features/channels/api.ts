import { client, unwrap } from '../../lib/api'
import type { ChannelPosition, CreateChannel, PutOverwrite, UpdateChannel } from '../../lib/types'

export const channelsApi = {
  list: (serverId: string) => unwrap(client.GET('/api/servers/{id}/channels', { params: { path: { id: serverId } } })),
  create: (serverId: string, body: CreateChannel) => unwrap(client.POST('/api/servers/{id}/channels', { params: { path: { id: serverId } }, body })),
  reorder: (serverId: string, body: ChannelPosition[]) => unwrap(client.PATCH('/api/servers/{id}/channels', { params: { path: { id: serverId } }, body })),
  update: (id: string, body: UpdateChannel) => unwrap(client.PATCH('/api/channels/{id}', { params: { path: { id } }, body })),
  remove: (id: string) => client.DELETE('/api/channels/{id}', { params: { path: { id } } }),
  putOverwrite: (id: string, targetId: string, body: PutOverwrite) =>
    unwrap(client.PUT('/api/channels/{id}/overwrites/{target_id}', { params: { path: { id, target_id: targetId } }, body })),
  deleteOverwrite: (id: string, targetId: string) =>
    unwrap(client.DELETE('/api/channels/{id}/overwrites/{target_id}', { params: { path: { id, target_id: targetId } } })),
}
