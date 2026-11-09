import { create } from 'zustand'

/** Live presence overrides from PRESENCE_UPDATE; member lists provide the initial value. */
export const usePresence = create<Record<string, boolean>>(() => ({}))

export function setPresence(userId: string, online: boolean) {
  usePresence.setState({ [userId]: online })
}

export function useIsOnline(userId: string, fallback: boolean): boolean {
  return usePresence((s) => s[userId] ?? fallback)
}
