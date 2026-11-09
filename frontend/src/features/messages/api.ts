import { client, fileBody, unwrap } from '../../lib/api'
import type { CreateMessage } from '../../lib/types'

export const PAGE_SIZE = 50

const messagePath = (cid: string, mid: string) => ({ params: { path: { cid, mid } } })

export const messagesApi = {
  list: (channelId: string, before: string | null) =>
    unwrap(client.GET('/api/channels/{id}/messages', { params: { path: { id: channelId }, query: { before, limit: PAGE_SIZE } } })),
  send: (channelId: string, body: CreateMessage) => unwrap(client.POST('/api/channels/{id}/messages', { params: { path: { id: channelId } }, body })),
  edit: (channelId: string, messageId: string, content: string) =>
    unwrap(client.PATCH('/api/channels/{cid}/messages/{mid}', { ...messagePath(channelId, messageId), body: { content } })),
  remove: (channelId: string, messageId: string) => client.DELETE('/api/channels/{cid}/messages/{mid}', messagePath(channelId, messageId)),
  upload: (channelId: string, file: File) =>
    unwrap(client.POST('/api/channels/{id}/attachments', { params: { path: { id: channelId } }, body: fileBody(file) })),
  react: (channelId: string, messageId: string, emoji: string) =>
    client.PUT('/api/channels/{cid}/messages/{mid}/reactions/{emoji}', { params: { path: { cid: channelId, mid: messageId, emoji } } }),
  unreact: (channelId: string, messageId: string, emoji: string) =>
    client.DELETE('/api/channels/{cid}/messages/{mid}/reactions/{emoji}', { params: { path: { cid: channelId, mid: messageId, emoji } } }),
  typing: (channelId: string) => client.POST('/api/channels/{id}/typing', { params: { path: { id: channelId } } }),
}
