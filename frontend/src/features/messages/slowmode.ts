import { useCallback, useSyncExternalStore } from 'react'
import { create } from 'zustand'

/** When each channel's slowmode wait ends (epoch ms), for this tab. */
const useCooldowns = create<Record<string, number>>(() => ({}))

export const cooldowns = {
  start: (channelId: string, seconds: number) => useCooldowns.setState({ [channelId]: Date.now() + seconds * 1000 }),
}

/** Seconds left before the member can send again in `channelId`; 0 when they can. */
export function useCooldown(channelId: string): number {
  const until = useCooldowns((st) => st[channelId] ?? 0)
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (until <= Date.now()) return () => undefined
      const id = window.setInterval(onChange, 250)
      return () => window.clearInterval(id)
    },
    [until],
  )
  return useSyncExternalStore(subscribe, () => Math.max(0, Math.ceil((until - Date.now()) / 1000)))
}

/** 45 -> "0:45", 3600 -> "1:00:00". */
export function formatWait(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** 30 -> "30 seconds", 120 -> "2 minutes", 3600 -> "1 hour". */
export function describeInterval(seconds: number): string {
  const [n, unit] = seconds % 3600 === 0 ? [seconds / 3600, 'hour'] : seconds % 60 === 0 ? [seconds / 60, 'minute'] : [seconds, 'second']
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

/** Choices in channel settings, in seconds. */
export const SLOWMODE_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600]
