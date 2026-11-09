import { client, unwrap } from '../../lib/api'

export const voiceApi = {
  ice: () => unwrap(client.GET('/api/config/ice')),
  serverStates: (serverId: string) => unwrap(client.GET('/api/servers/{id}/voice-states', { params: { path: { id: serverId } } })),
}
