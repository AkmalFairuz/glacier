import { client, unwrap } from '../../lib/api'

export const readsApi = {
  ack: (channelId: string, messageId: string) => client.PUT('/api/channels/{id}/ack', { params: { path: { id: channelId } }, body: { message_id: messageId } }),
  receipts: (channelId: string) => unwrap(client.GET('/api/channels/{id}/receipts', { params: { path: { id: channelId } } })),
}
