import { gateway, type GatewayEvent, type SignalData } from '../../lib/gateway'
import { keys } from '../../lib/keys'
import { queryClient } from '../../lib/queryClient'
import { compareIds } from '../../lib/format'
import type { Channel, User } from '../../lib/types'
import { toast } from '../../ui/toast'
import { useSession } from '../auth/useSession'
import { playSound } from '../settings/sounds'
import { settings, useSettings, type Settings } from '../settings/settingsStore'
import { voiceApi } from './api'
import { cameraConstraints, screenOptions } from './mediaConstraints'
import { Microphone } from './microphone'
import { clearSpeaking, unwatchRemote, watchRemote } from './speaking'
import { startGate, stopGate } from './transmitGate'
import { Peer } from './peerConnection'
import { bumpMedia, useVoice, voiceStates } from './voiceStore'

const RING_MS = 30_000
const FALLBACK_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }]

const peers = new Map<string, Peer>()
let iceServers: RTCIceServer[] | null = null
let ringTimer: number | undefined
let mic: Microphone | null = null

const meId = () => queryClient.getQueryData<User>(keys.me)?.id ?? ''
const state = () => useVoice.getState()
const localMedia = () => ({ main: state().localMain, screen: state().localScreen })

async function loadIce(): Promise<RTCIceServer[]> {
  if (iceServers) return iceServers
  iceServers = await voiceApi
    .ice()
    .then((c) => c.ice_servers)
    .catch(() => FALLBACK_ICE)
  return iceServers
}

function setRemote(userId: string, fn: (streams: MediaStream[], screenId: string | null) => Partial<{ streams: MediaStream[]; screenId: string | null }>) {
  useVoice.setState((s) => {
    const current = s.remote[userId] ?? { streams: [], screenId: null }
    return { remote: { ...s.remote, [userId]: { ...current, ...fn(current.streams, current.screenId) } }, mediaVersion: s.mediaVersion + 1 }
  })
}

function sendMeta(peerId?: string) {
  const data: SignalData = { meta: { screen_stream_id: state().localScreen?.id ?? null } }
  for (const id of peerId ? [peerId] : peers.keys()) gateway.send('VOICE_SIGNAL', { to_user_id: id, data })
}

function createPeer(userId: string, initiator: boolean): Peer {
  peers.get(userId)?.close()
  const peer = new Peer(compareIds(meId(), userId) < 0, iceServers ?? FALLBACK_ICE, localMedia, {
    signal: (data) => gateway.send('VOICE_SIGNAL', { to_user_id: userId, data }),
    onStream: (stream) => {
      watchRemote(userId, stream)
      setRemote(userId, (streams) => ({ streams: streams.some((s) => s.id === stream.id) ? streams : [...streams, stream] }))
    },
    onChange: bumpMedia,
  })
  peers.set(userId, peer)
  if (initiator) peer.attach()
  sendMeta(userId)
  return peer
}

function closePeer(userId: string) {
  peers.get(userId)?.close()
  peers.delete(userId)
  unwatchRemote(userId)
  useVoice.setState((s) => {
    const remote = { ...s.remote }
    delete remote[userId]
    return { remote }
  })
}

function connectToRoom(channelId: string) {
  for (const v of state().states[channelId] ?? []) {
    if (v.user_id !== meId()) createPeer(v.user_id, true)
  }
}

function sendFlags() {
  const { muted, deafened, video, screen } = state()
  gateway.send('VOICE_UPDATE', { muted, deafened, video, screen })
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

function syncAll() {
  peers.forEach((p) => p.syncTracks())
  bumpMedia()
}

/** Channel object from any cached server channel list, for limits and names. */
function cachedChannel(channelId: string, serverId: string | null): Channel | undefined {
  return serverId ? queryClient.getQueryData<Channel[]>(keys.channels(serverId))?.find((c) => c.id === channelId) : undefined
}

export async function join(channelId: string, serverId: string | null, opts: { video?: boolean } = {}) {
  if (state().session?.channelId === channelId) return
  const channel = cachedChannel(channelId, serverId)
  const others = (state().states[channelId] ?? []).filter((v) => v.user_id !== meId()).length
  if (channel?.user_limit && others >= channel.user_limit) {
    toast.error(`${channel.name} is full`)
    return
  }
  if (state().session) leave()
  useVoice.setState({ session: { channelId, serverId }, ring: null, notice: null })
  await loadIce()

  let opened: Microphone | null = null
  try {
    opened = await Microphone.open(settings.get())
  } catch {
    useVoice.setState({ muted: true, notice: 'Microphone unavailable. You joined listen-only.' })
  }
  if (state().session?.channelId !== channelId) return opened?.close()
  mic = opened
  if (mic) startGate(mic, meId())
  useVoice.setState({ localMain: new MediaStream(mic ? [mic.track] : []) })
  playSound('join')

  gateway.send('VOICE_JOIN', { channel_id: channelId })
  connectToRoom(channelId)
  if (opts.video) await toggleVideo()
  sendFlags()
}

export function leave() {
  if (!state().session) return
  gateway.send('VOICE_LEAVE', {})
  playSound('leave')
  teardown()
}

/** Local cleanup only: the server already considers us gone (or moved elsewhere). */
function teardown() {
  peers.forEach((p) => p.close())
  peers.clear()
  stopGate()
  stopStream(state().localMain)
  mic?.close()
  mic = null
  clearSpeaking()
  stopStream(state().localScreen)
  useVoice.setState({ session: null, localMain: null, localScreen: null, remote: {}, video: false, screen: false, notice: null })
}

export function toggleMute() {
  const muted = !state().muted
  useVoice.setState({ muted, deafened: muted ? state().deafened : false })
  playSound(muted ? 'mute' : 'unmute')
  if (state().session) sendFlags()
}

export function toggleDeafen() {
  const deafened = !state().deafened
  useVoice.setState({ deafened, muted: deafened || state().muted })
  playSound(deafened ? 'mute' : 'unmute')
  if (state().session) sendFlags()
}

export async function toggleVideo() {
  const main = state().localMain
  if (!main) return
  if (state().video) {
    main.getVideoTracks().forEach((t) => {
      t.stop()
      main.removeTrack(t)
    })
    useVoice.setState({ video: false })
  } else {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(settings.get()) })
      cam.getVideoTracks().forEach((t) => main.addTrack(t))
      useVoice.setState({ video: true })
    } catch {
      useVoice.setState({ notice: 'Camera unavailable.' })
      return
    }
  }
  syncAll()
  sendFlags()
}

export async function toggleScreen() {
  if (state().localScreen) {
    stopStream(state().localScreen)
    useVoice.setState({ localScreen: null, screen: false })
  } else {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia(screenOptions(settings.get()))
      screen.getVideoTracks().forEach((t) => (t.contentHint = settings.get().screenHint))
      screen.getVideoTracks()[0]?.addEventListener('ended', () => state().localScreen === screen && void toggleScreen())
      useVoice.setState({ localScreen: screen, screen: true })
    } catch {
      return
    }
  }
  sendMeta()
  syncAll()
  sendFlags()
}

async function onSignal(from: string, channelId: string, data: SignalData) {
  if (state().session?.channelId !== channelId) return
  if ('meta' in data) {
    setRemote(from, () => ({ screenId: data.meta.screen_stream_id }))
    return
  }
  const peer = peers.get(from) ?? createPeer(from, false)
  await peer.handle(data).catch((err: unknown) => console.warn('Signal handling failed', err))
}

/** Voice-related gateway events. Called by the app-wide gateway sync. */
export function handleVoiceEvent(event: GatewayEvent) {
  switch (event.t) {
    case 'READY': {
      voiceStates.replaceAll(event.d.voice_states)
      const session = state().session
      if (session) {
        peers.forEach((p) => p.close())
        peers.clear()
        useVoice.setState({ remote: {} })
        gateway.send('VOICE_JOIN', { channel_id: session.channelId })
        connectToRoom(session.channelId)
        sendFlags()
      }
      break
    }
    case 'VOICE_STATE_UPDATE': {
      const v = event.d
      const inMyRoom = v.channel_id === state().session?.channelId
      const isNew = !(state().states[v.channel_id] ?? []).some((x) => x.user_id === v.user_id)
      voiceStates.upsert(v)
      if (inMyRoom && isNew && v.user_id !== meId()) playSound('join')
      if (v.channel_id !== state().session?.channelId && peers.has(v.user_id)) closePeer(v.user_id)
      if (v.user_id === meId() && state().session && v.channel_id !== state().session?.channelId) teardown()
      break
    }
    case 'VOICE_STATE_DELETE': {
      voiceStates.remove(event.d.user_id, event.d.channel_id)
      if (event.d.channel_id === state().session?.channelId) {
        if (event.d.user_id === meId()) teardown()
        else {
          closePeer(event.d.user_id)
          playSound('leave')
        }
      }
      const ring = state().ring
      if (ring && ring.channelId === event.d.channel_id && ring.caller.id === event.d.user_id) useVoice.setState({ ring: null })
      break
    }
    case 'VOICE_SIGNAL':
      void onSignal(event.d.from_user_id, event.d.channel_id, event.d.data)
      break
    case 'ERROR':
      if (event.d.op === 'VOICE_JOIN' && state().session) {
        toast.error(event.d.message.charAt(0).toUpperCase() + event.d.message.slice(1))
        teardown()
      }
      break
    case 'CALL_RING':
      if (state().session?.channelId === event.d.channel_id) break
      useVoice.setState({ ring: { channelId: event.d.channel_id, caller: event.d.caller } })
      window.clearTimeout(ringTimer)
      ringTimer = window.setTimeout(() => useVoice.setState({ ring: null }), RING_MS)
      break
  }
}

export const dismissRing = () => useVoice.setState({ ring: null })

useSession.subscribe((s) => {
  if (s.token === null) leave()
})

const MIC_KEYS = ['inputDeviceId', 'inputProfile', 'echoCancellation', 'noiseSuppression', 'autoGainControl'] as const satisfies readonly (keyof Settings)[]
const CAMERA_KEYS = ['videoDeviceId', 'videoQuality', 'videoFps'] as const satisfies readonly (keyof Settings)[]
const changed = (keys: readonly (keyof Settings)[], a: Settings, b: Settings) => keys.some((k) => a[k] !== b[k])

/** Applies Voice & Video settings to a call in progress. */
useSettings.subscribe((next, prev) => {
  if (mic && changed(MIC_KEYS, next, prev)) {
    mic.configure(next).catch(() => useVoice.setState({ notice: 'Could not switch microphone.' }))
  } else if (mic && next.inputVolume !== prev.inputVolume) {
    mic.setVolume(next.inputVolume)
  }
  if (state().video && changed(CAMERA_KEYS, next, prev)) {
    void toggleVideo().then(() => toggleVideo())
  }
})

export type PeerStats = { userId: string; state: RTCPeerConnectionState; rttMs: number | null; packetsLost: number }

/** Connection health per peer, for Settings > Voice & Video > Advanced. */
export async function peerStats(): Promise<PeerStats[]> {
  return Promise.all(
    [...peers.entries()].map(async ([userId, peer]) => {
      let rttMs: number | null = null
      let packetsLost = 0
      const report = await peer.pc.getStats()
      report.forEach((stat: { type: string; state?: string; nominated?: boolean; currentRoundTripTime?: number; packetsLost?: number }) => {
        if (stat.type === 'candidate-pair' && stat.nominated && stat.state === 'succeeded' && stat.currentRoundTripTime !== undefined) {
          rttMs = Math.round(stat.currentRoundTripTime * 1000)
        }
        if (stat.type === 'inbound-rtp') packetsLost += stat.packetsLost ?? 0
      })
      return { userId, state: peer.pc.connectionState, rttMs, packetsLost }
    }),
  )
}
