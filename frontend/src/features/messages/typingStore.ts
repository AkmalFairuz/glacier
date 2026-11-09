import { create } from 'zustand'

const TYPING_MS = 8000

type Typer = { userId: string; name: string }

export const useTyping = create<Record<string, Typer[]>>(() => ({}))

const timers = new Map<string, number>()

function remove(channelId: string, userId: string) {
  useTyping.setState((s) => ({ [channelId]: (s[channelId] ?? []).filter((t) => t.userId !== userId) }))
}

export function startTyping(channelId: string, userId: string, name: string) {
  const key = `${channelId}:${userId}`
  window.clearTimeout(timers.get(key))
  timers.set(
    key,
    window.setTimeout(() => remove(channelId, userId), TYPING_MS),
  )
  useTyping.setState((s) => {
    const list = s[channelId] ?? []
    return list.some((t) => t.userId === userId) ? s : { [channelId]: [...list, { userId, name }] }
  })
}

export function stopTyping(channelId: string, userId: string) {
  window.clearTimeout(timers.get(`${channelId}:${userId}`))
  remove(channelId, userId)
}
