import { client, unwrap } from '../../lib/api'
import type { LoginBody, RegisterBody } from '../../lib/types'

export const authApi = {
  register: (body: RegisterBody) => unwrap(client.POST('/api/auth/register', { body })),
  login: (body: LoginBody) => unwrap(client.POST('/api/auth/login', { body })),
  logout: () => client.POST('/api/auth/logout'),
  me: () => unwrap(client.GET('/api/users/@me')),
}
