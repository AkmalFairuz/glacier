import { create } from 'zustand'
import type { User, VoiceState } from '../../lib/types'

export type RemoteMedia = { streams: MediaStream[]; screenId: string | null }

type VoiceStore = {
  /** Every known voice state, keyed by channel id. */
  states: Record<string, VoiceState[]>
  session: { channelId: string; serverId: string | null } | null
  muted: boolean
  deafened: boolean
  video: boolean
  screen: boolean
  localMain: MediaStream | null
  localScreen: MediaStream | null
  remote: Record<string, RemoteMedia>
  /** Bumped whenever tracks are added or removed so tiles re-render. */
  mediaVersion: number
  ring: { channelId: string; caller: User } | null
  notice: string | null
}

export const useVoice = create<VoiceStore>(() => ({
  states: {},
  session: null,
  muted: false,
  deafened: false,
  video: false,
  screen: false,
  localMain: null,
  localScreen: null,
  remote: {},
  mediaVersion: 0,
  ring: null,
  notice: null,
}))

const withoutUser = (states: Record<string, VoiceState[]>, userId: string) =>
  Object.fromEntries(Object.entries(states).map(([id, list]) => [id, list.filter((v) => v.user_id !== userId)]))

export const voiceStates = {
  replaceAll(list: VoiceState[]) {
    const states: Record<string, VoiceState[]> = {}
    for (const v of list) (states[v.channel_id] ??= []).push(v)
    useVoice.setState({ states })
  },
  replaceServer(serverId: string, list: VoiceState[]) {
    useVoice.setState((s) => {
      const states = Object.fromEntries(Object.entries(s.states).map(([id, l]) => [id, l.filter((v) => v.server_id !== serverId)]))
      for (const v of list) (states[v.channel_id] ??= []).push(v)
      return { states }
    })
  },
  upsert(state: VoiceState) {
    useVoice.setState((s) => {
      const states = withoutUser(s.states, state.user_id)
      states[state.channel_id] = [...(states[state.channel_id] ?? []), state]
      return { states }
    })
  },
  remove(userId: string, channelId: string) {
    useVoice.setState((s) => ({ states: { ...s.states, [channelId]: (s.states[channelId] ?? []).filter((v) => v.user_id !== userId) } }))
  },
}

export const bumpMedia = () => useVoice.setState((s) => ({ mediaVersion: s.mediaVersion + 1 }))

const EMPTY: VoiceState[] = []
export const useRoomStates = (channelId: string) => useVoice((s) => s.states[channelId] ?? EMPTY)
