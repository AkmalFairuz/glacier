import { client, unwrap } from '../../lib/api'
import type { ParsedQuery } from './parseQuery'
import type { SearchScope } from './searchStore'

export async function searchMessages(scope: SearchScope, p: ParsedQuery, before?: string) {
  // from:/in: named someone or something that doesn't exist here: nothing can match.
  if (p.author_id === 'none' || p.channel_id === 'none') return { messages: [], has_more: false }
  const query = { q: p.q, author_id: p.author_id, channel_id: p.channel_id, has: p.has, before }
  return scope.kind === 'server'
    ? unwrap(client.GET('/api/servers/{id}/messages/search', { params: { path: { id: scope.id }, query } }))
    : unwrap(client.GET('/api/channels/{id}/messages/search', { params: { path: { id: scope.id }, query } }))
}
