import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { onUnauthorized, tokenStore } from '../../lib/api'
import { gateway } from '../../lib/gateway'
import { keys } from '../../lib/keys'
import { queryClient } from '../../lib/queryClient'
import type { AuthResponse } from '../../lib/types'
import { authApi } from './api'

export const useSession = create<{ token: string | null }>(() => ({ token: tokenStore.get() }))

export function signIn(res: AuthResponse) {
  tokenStore.set(res.token)
  queryClient.setQueryData(keys.me, res.user)
  useSession.setState({ token: res.token })
}

export function endSession() {
  tokenStore.clear()
  gateway.close()
  queryClient.clear()
  useSession.setState({ token: null })
}

export async function signOut() {
  await authApi.logout().catch(() => undefined)
  endSession()
}

onUnauthorized(endSession)

export function useMe() {
  const token = useSession((s) => s.token)
  return useQuery({ queryKey: keys.me, queryFn: authApi.me, enabled: token !== null })
}
