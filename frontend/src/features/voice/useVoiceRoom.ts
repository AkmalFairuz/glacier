import { useShallow } from 'zustand/react/shallow'
import type { User } from '../../lib/types'
import { useMe } from '../auth/useSession'
import { useDms } from '../dms/hooks'
import { useMembers } from '../members/hooks'
import * as session from './voiceSession'
import { useRoomStates, useVoice } from './voiceStore'

export const joinVoice = (channelId: string, serverId: string | null, opts?: { video?: boolean }) => session.join(channelId, serverId, opts)
export const voiceActions = {
  leave: session.leave,
  toggleMute: session.toggleMute,
  toggleDeafen: session.toggleDeafen,
  toggleVideo: () => void session.toggleVideo(),
  toggleScreen: () => void session.toggleScreen(),
}

export const canShareScreen = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

/** Resolves voice participants to users via the server member list or the DM recipients. */
export function useRoomUsers(serverId: string | null): (userId: string) => User | undefined {
  const { data: me } = useMe()
  const { data: members } = useMembers(serverId ?? undefined)
  const { data: dms } = useDms()
  return (userId) =>
    (userId === me?.id ? me : undefined) ?? members?.find((m) => m.user.id === userId)?.user ?? dms?.flatMap((c) => c.recipients).find((u) => u.id === userId)
}

/** Everything a voice stage needs for one channel. */
export function useVoiceRoom(channelId: string) {
  const participants = useRoomStates(channelId)
  const connected = useVoice((s) => s.session?.channelId === channelId)
  const flags = useVoice(useShallow((s) => ({ muted: s.muted, deafened: s.deafened, video: s.video, screen: s.screen })))
  return { participants, connected, ...flags, ...voiceActions }
}
