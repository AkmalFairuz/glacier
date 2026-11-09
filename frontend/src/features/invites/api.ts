import { client, unwrap } from '../../lib/api'
import type { CreateInvite } from '../../lib/types'

const codePath = (code: string) => ({ params: { path: { code } } })

export const invitesApi = {
  create: (serverId: string, body: CreateInvite) => unwrap(client.POST('/api/servers/{id}/invites', { params: { path: { id: serverId } }, body })),
  list: (serverId: string) => unwrap(client.GET('/api/servers/{id}/invites', { params: { path: { id: serverId } } })),
  get: (code: string) => unwrap(client.GET('/api/invites/{code}', codePath(code))),
  accept: (code: string) => unwrap(client.POST('/api/invites/{code}', codePath(code))),
  revoke: (code: string) => client.DELETE('/api/invites/{code}', codePath(code)),
}

export const inviteUrl = (code: string) => `${location.origin}/invite/${code}`

/** Accepts a bare code or any URL ending in /invite/<code>. */
export function parseInviteCode(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1)
}
