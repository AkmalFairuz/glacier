import { create } from 'zustand'
import type { CustomStatus, Presence, PresenceSettings, Status, StatusSetting } from '../../lib/types'

export const OFFLINE: Presence = { status: 'offline', custom_status: null }

/** Live presence from READY and PRESENCE_UPDATE; member lists and profiles provide the initial value. */
export const usePresence = create<Record<string, Presence>>(() => ({}))

export function setPresence(userId: string, presence: Presence) {
  usePresence.setState({ [userId]: presence })
}

/** The live presence when known, else `fallback`. */
export function usePresenceOf(userId: string, fallback: Presence = OFFLINE): Presence {
  return usePresence((s) => s[userId]) ?? fallback
}

export function useIsOnline(userId: string, fallback: boolean): boolean {
  const live = usePresence((s) => s[userId])
  return live ? live.status !== 'offline' : fallback
}

/** A custom status that has text or an emoji and has not expired. */
export function activeCustomStatus(custom: CustomStatus | null | undefined): CustomStatus | null {
  if (!custom || (!custom.text && !custom.emoji)) return null
  if (custom.expires_at && Date.parse(custom.expires_at) <= Date.now()) return null
  return custom
}

/** The current user's own choice (Invisible included), for the status picker and their own avatar. */
export const useMyPresence = create<PresenceSettings>(() => ({ status: 'online', custom_status: null }))

export const myPresence = {
  set: (settings: PresenceSettings) => useMyPresence.setState({ status: settings.status, custom_status: settings.custom_status ?? null }),
}

/** How a chosen status looks on the user's own avatar. */
export const shownStatus = (setting: StatusSetting): Status => (setting === 'invisible' ? 'offline' : setting)

export const STATUS_LABELS: Record<StatusSetting | 'offline', string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Offline',
}
