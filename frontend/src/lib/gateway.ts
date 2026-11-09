import { create } from 'zustand'
import type { Channel, Member, Message, Role, Server, User, VoiceState } from './types'

export type ReadState = { channel_id: string; last_read_message_id: string }
export type ChannelHead = { channel_id: string; server_id: string | null; last_message_id: string }

export type ReadyPayload = {
  user: User
  servers: Server[]
  dms: Channel[]
  voice_states: VoiceState[]
  read_states: ReadState[]
  channel_heads: ChannelHead[]
  dm_unread: { channel_id: string; count: number }[]
  /** Online state of everyone the user shares a DM with, keyed by user id. */
  dm_presence?: Record<string, boolean>
}

export type ReactionEvent = { channel_id: string; message_id: string; user_id: string; emoji: string }

export type SignalData = { description: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit } | { meta: { screen_stream_id: string | null } }

export type GatewayEvent =
  | { t: 'READY'; d: ReadyPayload }
  | { t: 'HEARTBEAT_ACK'; d?: unknown }
  | { t: 'MESSAGE_CREATE' | 'MESSAGE_UPDATE'; d: Message }
  | { t: 'MESSAGE_DELETE'; d: { id: string; channel_id: string } }
  | { t: 'REACTION_ADD' | 'REACTION_REMOVE'; d: ReactionEvent }
  | { t: 'TYPING_START'; d: { channel_id: string; user_id: string; display_name: string } }
  | { t: 'CHANNEL_CREATE' | 'CHANNEL_UPDATE'; d: Channel }
  | { t: 'CHANNEL_DELETE'; d: { id: string; server_id: string | null } }
  | { t: 'SERVER_CREATE' | 'SERVER_UPDATE'; d: Server }
  | { t: 'SERVER_DELETE'; d: { id: string } }
  | { t: 'MEMBER_ADD' | 'MEMBER_UPDATE'; d: Member }
  | { t: 'MEMBER_REMOVE'; d: { server_id: string; user_id: string } }
  | { t: 'ROLE_CREATE' | 'ROLE_UPDATE'; d: Role }
  | { t: 'ROLE_DELETE'; d: { server_id: string; id: string } }
  | { t: 'PERMISSIONS_CHANGED'; d: { server_id: string } }
  | { t: 'PRESENCE_UPDATE'; d: { user_id: string; online: boolean } }
  | { t: 'USER_UPDATE'; d: User }
  | { t: 'VOICE_STATE_UPDATE'; d: VoiceState }
  | { t: 'VOICE_STATE_DELETE'; d: { user_id: string; channel_id: string } }
  | { t: 'VOICE_SIGNAL'; d: { from_user_id: string; channel_id: string; data: SignalData } }
  | { t: 'CALL_RING'; d: { channel_id: string; caller: User } }
  | { t: 'ERROR'; d: { message: string; op: string } }
  | { t: 'READ_STATE_UPDATE'; d: ReadState }
  | { t: 'RECEIPT_UPDATE'; d: ReadState & { user_id: string } }

export type GatewayStatus = 'idle' | 'connecting' | 'ready' | 'reconnecting'

export const useGatewayStatus = create<{ status: GatewayStatus }>(() => ({ status: 'idle' }))

type Listener = (event: GatewayEvent) => void

const HEARTBEAT_MS = 30_000
const MAX_BACKOFF_MS = 30_000

class GatewayClient {
  private socket: WebSocket | null = null
  private token: string | null = null
  private listeners = new Set<Listener>()
  private heartbeat: number | undefined
  private reconnectTimer: number | undefined
  private attempts = 0

  connect(token: string) {
    if (this.token === token && this.socket) return
    this.close()
    this.token = token
    this.open()
  }

  close() {
    this.token = null
    window.clearTimeout(this.reconnectTimer)
    window.clearInterval(this.heartbeat)
    this.socket?.close()
    this.socket = null
    useGatewayStatus.setState({ status: 'idle' })
  }

  send(op: string, d: unknown = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ op, d }))
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private open() {
    if (!this.token) return
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${scheme}://${location.host}/gateway?token=${encodeURIComponent(this.token)}`
    useGatewayStatus.setState({ status: this.attempts ? 'reconnecting' : 'connecting' })
    const socket = new WebSocket(url)
    this.socket = socket

    socket.onopen = () => {
      this.heartbeat = window.setInterval(() => this.send('HEARTBEAT'), HEARTBEAT_MS)
    }
    socket.onmessage = (msg) => {
      const event = JSON.parse(String(msg.data)) as GatewayEvent
      if (event.t === 'READY') {
        this.attempts = 0
        useGatewayStatus.setState({ status: 'ready' })
      }
      this.listeners.forEach((listener) => listener(event))
    }
    socket.onclose = () => {
      window.clearInterval(this.heartbeat)
      if (this.socket !== socket || !this.token) return
      this.socket = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    this.attempts += 1
    const delay = Math.min(1000 * 2 ** (this.attempts - 1), MAX_BACKOFF_MS)
    useGatewayStatus.setState({ status: 'reconnecting' })
    this.reconnectTimer = window.setTimeout(() => this.open(), delay + Math.random() * 500)
  }
}

export const gateway = new GatewayClient()
